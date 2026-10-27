import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { apiDevPlugin } from './vite/apiDevPlugin';

export default defineConfig({
  plugins: [react(), apiDevPlugin()],
  optimizeDeps: { include: ['pixi.js'] },
});
