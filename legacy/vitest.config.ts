import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Não varrer cópias de projeto dentro de worktrees do harness (.claude/worktrees)
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});
