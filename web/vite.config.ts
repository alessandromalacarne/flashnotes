import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

// Stryker runs the suite from a sandbox outside the project root, where Vite's
// fs allow list blocks the sqlite wasm asset imported with `?url`. Relax the
// check for tests only; the dev server keeps its strict allow list.
const testing = process.env.VITEST !== undefined;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: { strict: !testing },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    env: { NODE_ENV: 'test' },
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: [...configDefaults.exclude, '.stryker-tmp/**'],
  },
});
