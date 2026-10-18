import { Router, Request, Response } from 'express'
import { prisma } from '../services/db'
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  getLicenseStatus,
  UserTokenPayload,
} from '../services/auth.service'
import { sendDeveloperOtpEmail, AUTHORIZED_DEVELOPER_EMAIL } from '../services/email.service'

export const authRouter = Router()

interface DeveloperOtpEntry {
  email: string
  code: string
  expiresAt: number
  attempts: number
}

let activeDeveloperOtp: DeveloperOtpEntry | null = null

/**
 * Middleware: Extract and verify user from Bearer token
 */
export function authenticateToken(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. No Bearer token provided.' })
  }

  const token = authHeader.split(' ')[1]
  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ error: 'Session expired or invalid token. Please login again.' })
  }

  ;(req as any).user = decoded
  next()
}

/**
 * Middleware: Require DEVELOPER role
 */
export function requireDeveloper(req: Request, res: Response, next: () => void) {
  const user = (req as any).user as UserTokenPayload
  if (!user || user.role !== 'DEVELOPER') {
    return res.status(403).json({ error: 'Access denied: Developer privileges required.' })
  }
  next()
}

/**
 * GET /api/auth/license-status
 * Public endpoint to query current software activation & expiry status
 */
authRouter.get('/license-status', async (_req: Request, res: Response) => {
  try {
    const license = await getLicenseStatus()
    res.json({ success: true, license })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch license status', details: error.message })
  }
})

/**
 * POST /api/auth/login
 * User & Developer authentication
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' })
    }

    const cleanUsername = String(username).trim().toLowerCase()

    // Find user (case-insensitive search)
    const user = await prisma.user.findFirst({
      where: {
        username: cleanUsername,
      },
    })

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' })
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Your user account has been disabled. Contact developer.' })
    }

    // Verify password
    const isPasswordValid = verifyPassword(String(password), user.password, user.salt)
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password.' })
    }

    // Developer is NOT permitted to log in via password; strictly Email OTP only
    if (user.role === 'DEVELOPER') {
      return res.status(403).json({
        error: 'Developer password login is disabled. Please switch to the "Developer OTP Login" tab to authenticate with your verified email.',
        isDeveloperOtpRequired: true,
      })
    }

    // Check License Status
    const license = await getLicenseStatus()

    // Class owners are blocked if license is expired or inactive
    if (user.role === 'CLASS_OWNER') {
      if (!license.isActive) {
        return res.status(403).json({
          error: 'Your software subscription plan is expired or inactive. Please call the support team to renew your subscription plan.',
          isLicenseIssue: true,
          license,
        })
      }
      if (license.isExpired) {
        return res.status(403).json({
          error: `Your software subscription plan expired on ${new Date(license.expiryDate).toLocaleDateString('en-IN')}. Please call the support team to renew your subscription plan.`,
          isLicenseIssue: true,
          license,
        })
      }
    }

    // Generate Token
    const token = createToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role as any,
    })

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
      license,
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Login failed', details: error.message })
  }
})

/**
 * POST /api/auth/developer/send-otp
 * Dispatches a 6-digit OTP to prameshwar4378@gmail.com
 */
authRouter.post('/developer/send-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body || {}
    if (!email) {
      return res.status(400).json({ error: 'Developer email address is required.' })
    }

    const cleanEmail = String(email).trim().toLowerCase()
    if (cleanEmail !== AUTHORIZED_DEVELOPER_EMAIL) {
      return res.status(403).json({
        error: `Unauthorized email address. Developer access is strictly restricted to ${AUTHORIZED_DEVELOPER_EMAIL} only.`,
      })
    }

    // Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes expiry

    activeDeveloperOtp = {
      email: cleanEmail,
      code: otpCode,
      expiresAt,
      attempts: 0,
    }

    // Dispatch email via Gmail SMTP
    await sendDeveloperOtpEmail(cleanEmail, otpCode)

    res.json({
      success: true,
      message: `A 6-digit One-Time Password (OTP) has been sent to ${cleanEmail}. Please check your inbox.`,
      email: cleanEmail,
    })
  } catch (error: any) {
    console.error('Failed to send developer OTP email:', error)
    res.status(500).json({
      error: 'Failed to send OTP email. Please ensure your machine has internet access and try again.',
      details: error.message,
    })
  }
})

/**
 * POST /api/auth/developer/verify-otp
 * Verifies the 6-digit OTP and generates developer access token
 */
authRouter.post('/developer/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body || {}
    if (!email || !otp) {
      return res.status(400).json({ error: 'Developer email and 6-digit OTP are required.' })
    }

    const cleanEmail = String(email).trim().toLowerCase()
    if (cleanEmail !== AUTHORIZED_DEVELOPER_EMAIL) {
      return res.status(403).json({
        error: `Unauthorized email address. Developer access is strictly restricted to ${AUTHORIZED_DEVELOPER_EMAIL} only.`,
      })
    }

    if (!activeDeveloperOtp || activeDeveloperOtp.email !== cleanEmail) {
      return res.status(400).json({
        error: 'No active OTP found. Please click "Send OTP" to request a new code.',
      })
    }

    if (Date.now() > activeDeveloperOtp.expiresAt) {
      activeDeveloperOtp = null
      return res.status(400).json({
        error: 'The OTP code has expired. Please request a new OTP.',
      })
    }

    if (activeDeveloperOtp.attempts >= 5) {
      activeDeveloperOtp = null
      return res.status(400).json({
        error: 'Too many incorrect attempts. Please request a new OTP code.',
      })
    }

    const cleanOtp = String(otp).trim()
    if (cleanOtp !== activeDeveloperOtp.code) {
      activeDeveloperOtp.attempts++
      const remaining = 5 - activeDeveloperOtp.attempts
      return res.status(400).json({
        error: `Invalid OTP code. Please check your email and try again. (${remaining} attempts remaining)`,
      })
    }

    // OTP Valid! Clear active OTP
    activeDeveloperOtp = null

    // Find or create Developer user in database
    let devUser = await prisma.user.findFirst({
      where: { role: 'DEVELOPER' },
    })

    if (!devUser) {
      const { hash, salt } = hashPassword('developer_otp_verified')
      devUser = await prisma.user.create({
        data: {
          username: 'developer',
          password: hash,
          salt,
          name: 'Authorized Software Developer',
          role: 'DEVELOPER',
          isActive: true,
        },
      })
    }

    const license = await getLicenseStatus()

    // Generate 7-day token for Developer
    const token = createToken({
      id: devUser.id,
      username: devUser.username,
      name: devUser.name,
      role: 'DEVELOPER',
    })

    res.json({
      success: true,
      message: 'Developer authenticated successfully via email OTP.',
      token,
      user: {
        id: devUser.id,
        username: devUser.username,
        name: devUser.name,
        role: devUser.role,
        isActive: devUser.isActive,
        email: AUTHORIZED_DEVELOPER_EMAIL,
      },
      license,
    })
  } catch (error: any) {
    console.error('Failed to verify developer OTP:', error)
    res.status(500).json({ error: 'Failed to verify OTP', details: error.message })
  }
})

/**
 * GET /api/auth/me
 * Returns current authenticated user profile
 */
authRouter.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tokenUser = (req as any).user as UserTokenPayload
    const user = await prisma.user.findUnique({
      where: { id: tokenUser.id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    if (!user) {
      return res.status(404).json({ error: 'User no longer exists.' })
    }

    const license = await getLicenseStatus()
    res.json({ success: true, user, license })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve user profile', details: error.message })
  }
})

/**
 * POST /api/auth/change-own-password
 * Allows logged in user (Class Owner or Developer) to change their password
 */
authRouter.post('/change-own-password', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tokenUser = (req as any).user as UserTokenPayload
    const { currentPassword, newPassword } = req.body || {}

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' })
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' })
    }

    const user = await prisma.user.findUnique({ where: { id: tokenUser.id } })
    if (!user) {
      return res.status(404).json({ error: 'User not found.' })
    }

    const isMatch = verifyPassword(String(currentPassword), user.password, user.salt)
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' })
    }

    const { hash, salt } = hashPassword(String(newPassword))
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash, salt },
    })

    res.json({ success: true, message: 'Password updated successfully.' })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to change password', details: error.message })
  }
})

// =============================================================
// DEVELOPER PORTAL ENDPOINTS (Role: DEVELOPER required)
// =============================================================

/**
 * GET /api/auth/developer/users
 * Lists all users for developer management
 */
authRouter.get('/developer/users', authenticateToken, requireDeveloper, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ success: true, users })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch user list', details: error.message })
  }
})

/**
 * POST /api/auth/developer/update-user-password
 * Developer resets or changes a user's password directly
 */
authRouter.post(
  '/developer/update-user-password',
  authenticateToken,
  requireDeveloper,
  async (req: Request, res: Response) => {
    try {
      const { userId, newPassword } = req.body || {}
      if (!userId || !newPassword) {
        return res.status(400).json({ error: 'userId and newPassword are required.' })
      }

      if (String(newPassword).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' })
      }

      const user = await prisma.user.findUnique({ where: { id: String(userId) } })
      if (!user) {
        return res.status(404).json({ error: 'Target user not found.' })
      }

      const { hash, salt } = hashPassword(String(newPassword))
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hash, salt },
      })

      res.json({
        success: true,
        message: `Password updated successfully for ${user.name} (${user.username}).`,
      })
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to reset user password', details: error.message })
    }
  }
)

/**
 * POST /api/auth/developer/update-user
 * Developer updates username, display name, or active status
 */
authRouter.post('/developer/update-user', authenticateToken, requireDeveloper, async (req: Request, res: Response) => {
  try {
    const { userId, username, name, isActive } = req.body || {}
    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' })
    }

    const dataToUpdate: any = {}
    if (username !== undefined) {
      const clean = String(username).trim().toLowerCase()
      // Check if username taken by another user
      const duplicate = await prisma.user.findFirst({
        where: { username: clean, NOT: { id: String(userId) } },
      })
      if (duplicate) {
        return res.status(400).json({ error: `Username "${clean}" is already in use.` })
      }
      dataToUpdate.username = clean
    }

    if (name !== undefined) dataToUpdate.name = String(name).trim()
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive)

    const updated = await prisma.user.update({
      where: { id: String(userId) },
      data: dataToUpdate,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
      },
    })

    res.json({ success: true, message: 'User updated successfully.', user: updated })
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update user', details: error.message })
  }
})

/**
 * POST /api/auth/developer/update-license
 * Developer manages software activation & expiry date
 */
authRouter.post(
  '/developer/update-license',
  authenticateToken,
  requireDeveloper,
  async (req: Request, res: Response) => {
    try {
      const { isActive, expiryDate, developerNote, clientName } = req.body || {}

      if (isActive !== undefined) {
        await prisma.systemSetting.upsert({
          where: { key: 'license_is_active' },
          update: { value: String(Boolean(isActive)) },
          create: { key: 'license_is_active', value: String(Boolean(isActive)) },
        })
      }

      if (expiryDate !== undefined) {
        const parsed = new Date(expiryDate)
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ error: 'Invalid expiry date format.' })
        }
        await prisma.systemSetting.upsert({
          where: { key: 'license_expiry_date' },
          update: { value: parsed.toISOString() },
          create: { key: 'license_expiry_date', value: parsed.toISOString() },
        })
      }

      if (developerNote !== undefined) {
        await prisma.systemSetting.upsert({
          where: { key: 'license_developer_note' },
          update: { value: String(developerNote).trim() },
          create: { key: 'license_developer_note', value: String(developerNote).trim() },
        })
      }

      if (clientName !== undefined) {
        await prisma.systemSetting.upsert({
          where: { key: 'license_client_name' },
          update: { value: String(clientName).trim() },
          create: { key: 'license_client_name', value: String(clientName).trim() },
        })
      }

      const license = await getLicenseStatus()
      res.json({
        success: true,
        message: 'Software license parameters updated successfully.',
        license,
      })
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update license', details: error.message })
    }
  }
)
