import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/performance/**/*.perf.ts'],
    exclude: ['node_modules', 'dist', 'coverage', 'infra', 'datasets'],
    coverage: {
      enabled: false,
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'threads',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
