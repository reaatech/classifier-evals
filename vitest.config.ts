import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'coverage', 'infra', 'datasets'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'dist',
        'coverage',
        'infra',
        'datasets',
        'eslint.config.mjs',
        '**/*.d.ts',
        '**/*.config.ts',
        'tests/**/*.ts',
        'src/cli.ts',
        'src/cli/**',
        'src/mcp-server/**',
        'src/metrics/index.ts',
        'src/types/schemas.ts',
      ],
      thresholds: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
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
