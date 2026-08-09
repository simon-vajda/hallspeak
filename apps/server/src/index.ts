import { serve } from '@hono/node-server';
import { app } from './app';
import { env } from './env';

const server = serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, (info) => {
  console.log(`LinguaCast API listening on http://${env.HOST}:${info.port}`);
  console.log(`Docs: http://${env.HOST}:${info.port}/api/docs`);
});

const SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  // Future teardown (mediasoup workers, socket rooms) hangs off this path.
  const force = setTimeout(() => {
    console.error(`Did not close within ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();

  server.close((err) => {
    if (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
