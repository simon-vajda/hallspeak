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

  // Native modules cannot be bundled — a .node binary is not JavaScript. Both stay
  // real dependencies in package.json (ADR §8.5). They are not equivalent costs:
  // mediasoup compiles a C++ worker on the operator's machine, whereas
  // better-sqlite3 ships prebuilt N-API binaries in its tarball and asks nothing of
  // the toolchain. mediasoup is not installed yet — declared now because it is the
  // packaging invariant and costs nothing to establish.
  external: ['mediasoup', 'better-sqlite3'],

  // Emit dist/index.js, not dist/index.mjs, to match the "start" script.
  outExtensions: () => ({ js: '.js' }),
});
