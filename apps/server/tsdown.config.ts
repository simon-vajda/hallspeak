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
  external: ['mediasoup', 'better-sqlite3'],

  // Emit dist/index.js, not dist/index.mjs, to match the "start" script.
  outExtensions: () => ({ js: '.js' }),
});
