import { serve } from '@hono/node-server';
import { app } from './app';
import { closeDb, db } from './db';
import { runMigrations } from './db/migrate';
import { env } from './env';
import { attachSocket } from './socket';

// Before serve(): the process either has a current schema or fails to start, so the
// operator's upgrade procedure stays "pull and restart".
runMigrations(db);

const server = serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, (info) => {
  console.log(`LinguaCast API listening on http://${env.HOST}:${info.port}`);
  console.log(`Docs: http://${env.HOST}:${info.port}/api/docs`);
});

// Must come after serve(): Socket.IO takes over the HTTP server's request listeners.
const io = attachSocket(server);

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

  // Before server.close(): open sockets are live connections on that server, and
  // server.close() waits for them. io.close() disconnects them first.
  io.close(() => {
    server.close((err) => {
      // io.close() already closed the HTTP server, so "not running" is the expected
      // path; reporting it would make every clean SIGTERM exit 1.
      if (err && !('code' in err && err.code === 'ERR_SERVER_NOT_RUNNING')) {
        console.error('Error during shutdown:', err);
        closeDb();
        process.exit(1);
      }
      closeDb();
      process.exit(0);
    });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
