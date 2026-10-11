import { Router, Request, Response } from 'express'
import { prisma, checkDatabaseConnection } from '../services/db'
import { storagePaths, NODE_ENV } from '../config/index'
import type { HealthCheckResponse } from '@sutawane/shared'

export const healthRouter = Router()

healthRouter.get('/', async (_req: Request, res: Response) => {
  const isDbConnected = await checkDatabaseConnection()
  let studentCount = 0

  if (isDbConnected) {
    try {
      studentCount = await prisma.student.count()
      await prisma.healthLog.create({
        data: {
          status: 'healthy',
          details: `Health check requested at ${new Date().toISOString()}`,
        },
      })
    } catch {
      // Non-fatal if logging fails
    }
  }

  const response: HealthCheckResponse = {
    status: isDbConnected ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: NODE_ENV,
    version: '1.0.0',
    database: {
      connected: isDbConnected,
      provider: 'sqlite',
      dbLocation: storagePaths.databasePath,
      studentCount,
    },
    storage: {
      dataPath: storagePaths.baseDir,
      photosPath: storagePaths.photosDir,
      attachmentsPath: storagePaths.attachmentsDir,
      backupsPath: storagePaths.backupsDir,
    },
  }

  res.status(isDbConnected ? 200 : 503).json(response)
})
