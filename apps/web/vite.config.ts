import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { apiDevPlugin } from './vite/apiDevPlugin';

export default defineConfig({
  // O guia e o .env.example colocam .env.local na raiz do repositório.
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [react(), apiDevPlugin()],
  optimizeDeps: { include: ['pixi.js'] },
});
