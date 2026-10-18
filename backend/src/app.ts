import express, { Application, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { healthRouter } from './routes/health.router'
import { branchRouter } from './routes/branch.router'
import { sessionRouter } from './routes/session.router'
import { studentRouter } from './routes/student.router'
import { feeRouter } from './routes/fee.router'
import { expenseRouter } from './routes/expense.router'
import { dashboardRouter } from './routes/dashboard.router'
import { settingRouter } from './routes/setting.router'
import { courseRouter } from './routes/course.router'
import { reportRouter } from './routes/report.router'
import { backupRouter, createFullBackupSnapshot } from './routes/backup.router'
import { authRouter } from './routes/auth.router'
import { getLicenseStatus, verifyToken } from './services/auth.service'
import { storagePaths } from './config/index'

export function createApp(): Application {
  const app = express()

  // Middleware
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  )
  app.use(express.json())

  // Serve persistent photos and attachments
  app.use('/api/uploads/photos', express.static(storagePaths.photosDir))
  app.use('/api/uploads/attachments', express.static(storagePaths.attachmentsDir))

  // Unrestricted API Routes
  app.use('/api/health', healthRouter)
  app.use('/api/auth', authRouter)

  // License Guard Middleware: Blocks operational routes if software is expired or deactivated (unless DEVELOPER)
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const license = await getLicenseStatus()
      if (!license.isActive || license.isExpired) {
        // Check for developer token
        const authHeader = req.headers.authorization
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const decoded = verifyToken(authHeader.split(' ')[1])
          if (decoded && decoded.role === 'DEVELOPER') {
            return next()
          }
        }
        return res.status(403).json({
          error: 'Your software subscription plan is expired. Please call the support team to renew your subscription plan.',
          isLicenseIssue: true,
          license,
        })
      }
      next()
    } catch {
      next()
    }
  })

  // Protected Operational Routes
  app.use('/api/branches', branchRouter)
  app.use('/api/sessions', sessionRouter)
  app.use('/api/students', studentRouter)
  app.use('/api/courses', courseRouter)
  app.use('/api/fees', feeRouter)
  app.use('/api/expenses', expenseRouter)
  app.use('/api/dashboard', dashboardRouter)
  app.use('/api/settings', settingRouter)
  app.use('/api/reports', reportRouter)
  app.use('/api/backup', backupRouter)

  // One-click Backup Endpoint (Backward-compatible fallback delegating to full backup)
  app.post('/api/system/backup', async (_req: Request, res: Response) => {
    try {
      const backup = await createFullBackupSnapshot()
      res.json({
        success: true,
        backupFileName: backup.fileName,
        backupPath: backup.filePath,
        sizeBytes: backup.sizeBytes,
        timestamp: backup.createdAt,
      })
    } catch (error) {
      res.status(500).json({ error: 'Failed to create backup snapshot', details: String(error) })
    }
  })

  // Global API 404 handler
  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' })
  })

  // Serve Frontend Production Assets (Single Page Application Fallback)
  const resourcesPath = (process as any).resourcesPath || ''
  const candidateFrontendDirs = [
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(__dirname, '../../../frontend/dist'),
    path.resolve(resourcesPath, 'frontend/dist'),
    path.resolve(resourcesPath, 'app.asar/frontend/dist'),
  ]
  const frontendDistPath = candidateFrontendDirs.find(
    (d) => d && fs.existsSync(d) && fs.existsSync(path.join(d, 'index.html'))
  )

  if (frontendDistPath) {
    app.use(express.static(frontendDistPath))
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) {
        return next()
      }
      res.sendFile(path.join(frontendDistPath, 'index.html'))
    })
  }

  // Global Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err)
    res.status(500).json({ error: 'Internal server error', message: err.message })
  })

  return app
}
