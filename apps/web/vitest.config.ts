import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Deliberately not `vite.config.ts`: the tests here cover pure helpers only — no jsdom,
// no component rendering — so loading the router and Tailwind plugins to run them would
// be cost with no return. The `@` alias is the one thing they do need.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: { include: ['src/**/*.test.ts'] },
});
