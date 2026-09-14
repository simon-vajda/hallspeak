import { serve } from '@hono/node-server';
import { app } from './app';
import { credentialsPath, isConfigured, startAuth, sweepExpired } from './core/auth';
import { startMedia, stopMedia } from './core/media';
import { closeDb, db } from './db';
import { runMigrations } from './db/migrate';
import { env } from './env';
import { attachSocket } from './socket';

// Before serve(): the process either has a current schema or fails to start, so the
// operator's upgrade procedure stays "pull and restart".
runMigrations(db);

// Read once, and fatal on a damaged file: treating one as "unconfigured" would silently
// re-open the account-claim window after a disk glitch.
startAuth();
// Boot is the only scheduled sweep; later lookups delete expired rows where they find them.
sweepExpired(db);
console.log(
  isConfigured()
    ? `Admin account loaded from ${credentialsPath()}`
    : `No admin account at ${credentialsPath()} — the setup wizard is open to whoever reaches it first`,
);
// Reaching the server directly over plain HTTP gives a working listener page, a studio
// that cannot open a microphone, and a sign-in that fails silently because the Secure
// cookie is discarded — with no error anywhere.
console.log('Serve this behind HTTPS: microphone capture and the admin session both require it.');
if (env.TRUSTED_PROXY_IPS.length === 0) {
  // Unset is the safe default — a forged header must never move a bucket — but behind a
  // reverse proxy it means every visitor shares the proxy's address, so one guesser can
  // spend the sign-in budget the administrator needs.
  console.warn(
    'TRUSTED_PROXY_IPS is unset: if a reverse proxy fronts this server, every client shares ' +
      "one sign-in throttle bucket. Set it to the proxy's address.",
  );
}

// Also before serve(), and fatal for the same reason: a deployment that cannot start a
// worker cannot carry audio, and finding that out on the first Go live is worse than
// finding it out at boot. A worker dying *later* is deliberately not fatal — one crash
// must not silence every concurrent event.
await startMedia({
  net: {
    listenIp: env.MEDIA_LISTEN_IP,
    announcedIp: env.PUBLIC_ADDRESS,
    rtcPortBase: env.MEDIA_RTC_PORT_BASE,
    maxWorkers: env.MEDIA_MAX_WORKERS,
  },
  stunUrl: env.MEDIA_STUN_URL,
  graceMs: env.MEDIA_ROOM_IDLE_GRACE_MS,
  probeReflexiveAddress: true,
});

const server = serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, (info) => {
  console.log(`LinguaCast API listening on http://${env.HOST}:${info.port}`);
  console.log(`Docs: http://${env.HOST}:${info.port}/api/docs`);
});

// Must come after serve(): Socket.IO takes over the HTTP server's request listeners.
const io = attachSocket(server);

const SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  const force = setTimeout(() => {
    console.error(`Did not close within ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();

  // Rooms and workers first: the worker subprocesses outlive this process if nothing
  // closes them, and there is no later point on this path that could.
  void stopMedia()
    .catch((cause) => {
      // A failed worker teardown must not strand the socket, HTTP and database close.
      console.error('Error stopping media:', cause);
    })
    .then(() => {
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
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
