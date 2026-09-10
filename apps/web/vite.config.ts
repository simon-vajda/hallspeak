import { execFileSync } from 'node:child_process';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The build context can be a checkout or an image build with no repository in it, so the
 * commit is taken from GIT_COMMIT when one is supplied and read from git otherwise. An
 * empty string is a valid answer: the footer prints the version alone.
 */
function gitCommit(): string {
  const supplied = process.env.GIT_COMMIT?.trim();
  if (supplied) {
    return supplied.slice(0, 7);
  }
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

export default defineConfig({
  define: { __GIT_COMMIT__: JSON.stringify(gitCommit()) },
  plugins: [
    // Required by TanStack: the router plugin MUST come before @vitejs/plugin-react.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: {
    port: 5173,
    // One rule covers the API and the socket: the socket is mounted at a path under /api
    // rather than at a namespace of its own.
    proxy: { '/api': { target: 'http://localhost:3000', ws: true } },
  },
});
