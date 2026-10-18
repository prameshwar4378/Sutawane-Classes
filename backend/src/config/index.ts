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

  // If database does not exist, initialize from bundled template.db
  const resourcesPath = (process as any).resourcesPath || '';
  if (!fs.existsSync(databasePath)) {
    const candidateTemplatePaths = [
      path.resolve(__dirname, '../../prisma/template.db'),
      path.resolve(__dirname, '../../../backend/prisma/template.db'),
      path.resolve(resourcesPath, 'backend/prisma/template.db'),
      path.resolve(resourcesPath, 'template.db'),
      path.resolve(__dirname, 'template.db'),
    ];
    for (const tPath of candidateTemplatePaths) {
      if (tPath && fs.existsSync(tPath)) {
        try {
          fs.copyFileSync(tPath, databasePath);
          console.log(`[Database] Initialized new persistent database from template: ${tPath}`);
          break;
        } catch (e) {
          console.error(`[Database] Failed to copy template from ${tPath}:`, e);
        }
      }
    }
  }

  // Ensure master logo is populated in photosDir if not present
  const defaultLogoTarget = path.join(photosDir, 'logo-master-1792115174632.png');
  if (!fs.existsSync(defaultLogoTarget)) {
    const candidateLogoPaths = [
      path.resolve(__dirname, '../../prisma/logo-master.png'),
      path.resolve(__dirname, '../../../backend/prisma/logo-master.png'),
      path.resolve(__dirname, '../../../data/dev/photos/logo-master-1792115174632.png'),
      path.resolve(resourcesPath, 'backend/prisma/logo-master.png'),
    ];
    for (const lPath of candidateLogoPaths) {
      if (lPath && fs.existsSync(lPath)) {
        try {
          fs.copyFileSync(lPath, defaultLogoTarget);
          console.log(`[Branding] Master logo seeded from: ${lPath}`);
          break;
        } catch {}
      }
    }
  }

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
