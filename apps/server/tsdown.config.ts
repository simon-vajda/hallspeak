import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  outDir: 'dist',
  sourcemap: true,
  dts: false,
  clean: true,

  // tsdown externalizes package.json dependencies by default. Invert that: the whole
  // point of ADR §8.2 (contract has no build step) is that consumers inline it, and
  // ADR §8.5 wants Hono/Zod/contract in the bundle so the deploy artifact is
  // "bundle + a small real node_modules" rather than a full dependency tree.
  noExternal: [/.*/],

  // mediasoup builds a native C++ worker binary that cannot be bundled (ADR §8.5).
  // It stays a real dependency in package.json. Not installed yet — declared now
  // because it is the packaging invariant and costs nothing to establish.
  external: ['mediasoup'],

  // Emit dist/index.js, not dist/index.mjs, to match the "start" script.
  outExtensions: () => ({ js: '.js' }),
});
