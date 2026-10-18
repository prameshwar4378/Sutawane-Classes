import { createApp } from './app';
import { PORT, storagePaths } from './config/index';
import { checkDatabaseConnection } from './services/db';
import { seedDefaultUsers } from './services/auth.service';

async function bootstrap() {
  const app = createApp();

  const isConnected = await checkDatabaseConnection();
  if (isConnected) {
    console.log(`[Database] SQLite connected successfully at: ${storagePaths.databasePath}`);
    await seedDefaultUsers();
  } else {
    console.warn(`[Database] SQLite connection check failed. Will attempt to run migrations or db push.`);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Sutawane Classes API] Server listening on http://localhost:${PORT}`);
    console.log(`[Storage] Base directory: ${storagePaths.baseDir}`);
  });

  const shutdown = async () => {
    console.log('[Sutawane Classes API] Shutting down gracefully...');
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Sutawane Classes API] Failed to start:', err);
  process.exit(1);
});
