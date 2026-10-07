import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // settings live in the root .env (apps/web/.env still works); only VITE_* values are ever exposed
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  // 5174, not Vite's default 5173: another local project already uses 5173
  server: { port: 5174, strictPort: true },
  // component tests (npm test -w apps/web)
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.{js,jsx}'],
    css: false,
  },
});
