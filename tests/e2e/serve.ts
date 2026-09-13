import { startFixtureServer } from './server';

const server = await startFixtureServer(4321);
console.log('[fixtures] serving on http://localhost:4321');

const shutdown = (): void => {
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
