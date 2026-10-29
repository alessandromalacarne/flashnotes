import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
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
