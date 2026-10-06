// Dev-only harness for Person B's pages. Person A's shell is not built yet, so imports of A's files
// (lib/api, lib/auth, components/ui/Card, components/ui/Button) are pointed at stand-ins here.
// B's files keep A's real import paths, so nothing changes at integration.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const B_SRC = path.resolve(here, '../apps/web/src');

// A's file (relative to apps/web/src, no extension) → our stand-in
const STAND_INS = {
  'lib/api': 'src/stand-ins/api.js',
  'lib/auth': 'src/stand-ins/auth.js',
  'components/ui/Card': 'src/stand-ins/Card.jsx',
  'components/ui/Button': 'src/stand-ins/Button.jsx',
};

function personAStandIns() {
  return {
    name: 'person-a-stand-ins',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) return null;
      const target = path.resolve(path.dirname(importer.split('?')[0]), source);
      const rel = path.relative(B_SRC, target).split(path.sep).join('/').replace(/\.(jsx?|tsx?)$/, '');
      return STAND_INS[rel] ? normalizePath(path.resolve(here, STAND_INS[rel])) : null;
    },
  };
}

export default defineConfig({
  plugins: [personAStandIns(), react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom', 'react-router-dom', 'axios', 'zustand'] },
  server: { port: 5180, strictPort: true, fs: { allow: [path.resolve(here, '..')] } },
  preview: { port: 5180, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.{js,jsx}'],
    css: false,
  },
});
