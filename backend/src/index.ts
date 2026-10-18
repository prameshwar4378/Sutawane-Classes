import { createApp } from './app';
import { PORT, storagePaths } from './config/index';
import { checkDatabaseConnection } from './services/db';
import { seedDefaultUsers } from './services/auth.service';

export async function startServer(customPort?: number): Promise<any> {
  const port = customPort || PORT;
  const app = createApp();

  const isConnected = await checkDatabaseConnection();
  if (isConnected) {
    console.log(`[Database] SQLite connected successfully at: ${storagePaths.databasePath}`);
    await seedDefaultUsers();
  } else {
    console.warn(`[Database] SQLite connection check failed. Will attempt to run migrations or db push.`);
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`[Sutawane Classes API] Server listening on http://localhost:${port}`);
      console.log(`[Storage] Base directory: ${storagePaths.baseDir}`);
      resolve(server);
    });

    server.on('error', (err: any) => {
      console.error('[Sutawane Classes API] Server listen error:', err);
      reject(err);
    });

    const shutdown = async () => {
      console.log('[Sutawane Classes API] Shutting down gracefully...');
      server.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  });
}

// Automatically bootstrap if executed directly or in standalone dev/prod mode
if (require.main === module || !process.env.IS_ELECTRON_MAIN) {
  startServer().catch((err) => {
    console.error('[Sutawane Classes API] Failed to start:', err);
    process.exit(1);
  });
}
