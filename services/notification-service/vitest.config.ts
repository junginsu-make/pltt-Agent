import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@palette/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
