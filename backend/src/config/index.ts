import fs from 'fs';
import path from 'path';

export interface StoragePaths {
  baseDir: string;
  databaseDir: string;
  databasePath: string;
  photosDir: string;
  attachmentsDir: string;
  backupsDir: string;
}

export function resolveDataDirectory(): StoragePaths {
  let baseDir: string;

  if (process.env.SUTAWANE_DATA_DIR) {
    baseDir = path.resolve(process.env.SUTAWANE_DATA_DIR);
  } else if (process.env.NODE_ENV === 'production' || process.env.ELECTRON_RUN_AS_NODE || process.env.IS_ELECTRON) {
    // OS persistent application data directory
    const appData = process.env.APPDATA ||
      (process.platform === 'darwin'
        ? path.join(process.env.HOME || '', 'Library', 'Application Support')
        : path.join(process.env.HOME || '', '.local', 'share'));
    baseDir = path.join(appData, 'SutawaneClasses');
  } else {
    // In local development, use persistent local dev directory
    baseDir = path.resolve(__dirname, '../../../data/dev');
  }

  const databaseDir = path.join(baseDir, 'database');
  const databasePath = path.join(databaseDir, 'sutawane.db');
  const photosDir = path.join(baseDir, 'photos');
  const attachmentsDir = path.join(baseDir, 'attachments');
  const backupsDir = path.join(baseDir, 'backups');

  // Ensure persistent directories exist
  [baseDir, databaseDir, photosDir, attachmentsDir, backupsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  return {
    baseDir,
    databaseDir,
    databasePath,
    photosDir,
    attachmentsDir,
    backupsDir
  };
}

export const storagePaths = resolveDataDirectory();

// Ensure Prisma has the SQLite database URL configured
if (!process.env.DATABASE_URL) {
  // SQLite format: file:/c:/path/to/sutawane.db or file:C:\...
  // In Prisma, standard file path is file:C:/... or relative
  const normalizedPath = storagePaths.databasePath.replace(/\\/g, '/');
  process.env.DATABASE_URL = `file:${normalizedPath}`;
}

export const PORT = Number(process.env.PORT) || 5000;
export const NODE_ENV = process.env.NODE_ENV || 'development';
