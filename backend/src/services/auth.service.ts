import crypto from 'crypto'
import { prisma } from './db'

const JWT_SECRET = process.env.JWT_SECRET || 'sutawane_classes_secure_auth_key_2026_98x'

export interface UserTokenPayload {
  id: string
  username: string
  name: string
  role: 'CLASS_OWNER' | 'DEVELOPER'
  exp?: number
}

export interface LicenseStatus {
  isActive: boolean
  expiryDate: string
  isExpired: boolean
  daysRemaining: number
  developerNote: string
  clientName: string
}

/**
 * Hash password with PBKDF2 and random salt
 */
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return { hash, salt }
}

/**
 * Verify given password against stored hash and salt
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const calculated = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(hash, 'hex'))
}

/**
 * Create HMAC-signed Auth Token (7 days expiration)
 */
export function createToken(payload: UserTokenPayload): string {
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days
  const data = { ...payload, exp }
  const dataStr = Buffer.from(JSON.stringify(data)).toString('base64url')
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(dataStr).digest('base64url')
  return `${dataStr}.${signature}`
}

/**
 * Verify and decode HMAC-signed Auth Token
 */
export function verifyToken(token: string): UserTokenPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [dataStr, signature] = parts
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(dataStr).digest('base64url')

    if (signature !== expectedSig) return null

    const data: UserTokenPayload = JSON.parse(Buffer.from(dataStr, 'base64url').toString('utf8'))
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null // Expired token
    }
    return data
  } catch {
    return null
  }
}

/**
 * Get or initialize system Software License status
 */
export async function getLicenseStatus(): Promise<LicenseStatus> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          'license_is_active',
          'license_expiry_date',
          'license_developer_note',
          'license_client_name',
        ],
      },
    },
  })

  const map = settings.reduce((acc, curr) => {
    acc[curr.key] = curr.value
    return acc
  }, {} as Record<string, string>)

  // Default expiry: 1 year from today if not set
  let expiryDate = map.license_expiry_date
  if (!expiryDate) {
    const oneYearLater = new Date()
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
    expiryDate = oneYearLater.toISOString()
    await prisma.systemSetting.upsert({
      where: { key: 'license_expiry_date' },
      update: { value: expiryDate },
      create: { key: 'license_expiry_date', value: expiryDate },
    })
  }

  const isActive = map.license_is_active !== 'false'
  const developerNote = map.license_developer_note || 'Support Helpline: +91 7776824564 (Mr. Rameshwar Pawar)'
  const clientName = map.license_client_name || 'Sutawane Classes'

  const expiryTime = new Date(expiryDate).getTime()
  const now = Date.now()
  const isExpired = now > expiryTime
  const daysRemaining = isExpired ? 0 : Math.max(0, Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24)))

  return {
    isActive,
    expiryDate,
    isExpired,
    daysRemaining,
    developerNote,
    clientName,
  }
}

/**
 * Seed Default Users on startup if none exist
 */
export async function seedDefaultUsers(): Promise<void> {
  try {
    // 1. Ensure Developer Account exists
    const existingDev = await prisma.user.findFirst({
      where: { role: 'DEVELOPER' },
    })
    if (!existingDev) {
      const { hash, salt } = hashPassword('developer@123')
      await prisma.user.create({
        data: {
          username: 'developer',
          password: hash,
          salt,
          name: 'Software Developer',
          role: 'DEVELOPER',
          isActive: true,
        },
      })
      console.log('[Auth] Default Developer account seeded: username: "developer", pass: "developer@123"')
    }

    // 2. Ensure Class Owner Account exists
    const existingOwner = await prisma.user.findFirst({
      where: { role: 'CLASS_OWNER' },
    })
    if (!existingOwner) {
      const { hash, salt } = hashPassword('sutawane@123')
      await prisma.user.create({
        data: {
          username: 'sutawane',
          password: hash,
          salt,
          name: 'Class Owner (Admin)',
          role: 'CLASS_OWNER',
          isActive: true,
        },
      })
      console.log('[Auth] Default Class Owner account seeded: username: "sutawane", pass: "sutawane@123"')
    }

    // 3. Ensure Default License settings exist
    await getLicenseStatus()
  } catch (error) {
    console.error('[Auth] Error while seeding default users/license:', error)
  }
}
