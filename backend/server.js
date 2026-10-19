const fs = require('fs');
const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const connectDB = require('./config/db');
const Document = require('./models/Document');
const { uploadRoot } = require('./middleware/upload');

async function start() {
  fs.mkdirSync(uploadRoot, { recursive: true });
  await connectDB();

  // A crash or restart can leave documents stuck in "processing"; let users retry them.
  const stuck = await Document.updateMany(
    { status: 'processing' },
    { status: 'failed', errorMessage: 'Processing was interrupted. Use "Retry processing".' }
  );
  if (stuck.modifiedCount) logger.warn(`Marked ${stuck.modifiedCount} interrupted document(s) as failed`);
  await Document.updateMany({ analysisStatus: 'running' }, { analysisStatus: 'failed' });

  const server = app.listen(env.port, () => logger.info(`API listening on http://localhost:${env.port} (${env.nodeEnv})`));

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  logger.error(`Failed to start: ${err.stack}`);
  process.exit(1);
});
