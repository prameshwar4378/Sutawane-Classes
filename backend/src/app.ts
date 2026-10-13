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

  // API Routes
  app.use('/api/health', healthRouter)
  app.use('/api/branches', branchRouter)
  app.use('/api/sessions', sessionRouter)
  app.use('/api/students', studentRouter)
  app.use('/api/fees', feeRouter)
  app.use('/api/expenses', expenseRouter)
  app.use('/api/dashboard', dashboardRouter)
  app.use('/api/settings', settingRouter)

  // One-click Backup Endpoint
  app.post('/api/system/backup', async (_req: Request, res: Response) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupFileName = `sutawane-backup-${timestamp}.db`
      const backupFilePath = path.join(storagePaths.backupsDir, backupFileName)

      if (fs.existsSync(storagePaths.databasePath)) {
        fs.copyFileSync(storagePaths.databasePath, backupFilePath)
        res.json({
          success: true,
          backupFileName,
          backupPath: backupFilePath,
          sizeBytes: fs.statSync(backupFilePath).size,
          timestamp: new Date().toISOString(),
        })
      } else {
        res.status(404).json({ error: 'Source database file not found' })
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to create backup snapshot', details: String(error) })
    }
  })

  // Global 404 handler
  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' })
  })

  // Global Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err)
    res.status(500).json({ error: 'Internal server error', message: err.message })
  })

  return app
}
