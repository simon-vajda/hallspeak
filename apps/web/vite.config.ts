import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // Required by TanStack: the router plugin MUST come before @vitejs/plugin-react.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: {
    port: 5173,
    // One rule covers the API and the socket, because the socket is mounted at a path
    // under /api rather than at a namespace of its own. ws: true upgrades it.
    proxy: { '/api': { target: 'http://localhost:3000', ws: true } },
  },
});
