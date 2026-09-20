import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  outDir: 'dist',
  sourcemap: true,
  dts: false,
  clean: true,

  // Inverts tsdown's default of externalizing dependencies: the contract has no build
  // step, and the deploy artifact is a bundle plus a small real node_modules.
  noExternal: [/.*/],

  // Native modules cannot be bundled and stay real dependencies. mediasoup is not
  // installed yet; declared now because it is the packaging invariant.
  //
  // The pino packages are external for a different reason: a pino transport target is
  // resolved by module path inside a worker thread, so a bundled copy is a path that
  // does not exist at runtime and the logger fails to start. thread-stream is what
  // performs that resolution.
  external: ['mediasoup', 'better-sqlite3', 'pino', 'pino-pretty', 'pino-roll', 'thread-stream'],

  // Emit dist/index.js, not dist/index.mjs, to match the "start" script.
  outExtensions: () => ({ js: '.js' }),
});
