import { PrismaClient } from '@prisma/client';
import { storagePaths } from '../config/index';

// Initialize Prisma client with custom datasource URL pointing to persistent storage
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || `file:${storagePaths.databasePath.replace(/\\/g, '/')}`
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
});

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}
