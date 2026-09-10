import { createApp } from './app.js';

const PORT = process.env.PORT || 4000;
const DB_PATH = process.env.DB_PATH || './data/craftfunnel.db';

const { app } = createApp(DB_PATH, true);

const server = app.listen(PORT, () => {
  console.log(`[CraftFunnel API] Server listening on http://localhost:${PORT}`);
});

function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
