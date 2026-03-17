import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*/vitest.config.ts',
  'services/*/vitest.config.ts',
  'apps/*/vitest.config.ts',
]);

// Shared coverage thresholds for all workspaces
// Individual vitest.config.ts files should include:
// coverage: {
//   provider: 'v8',
//   thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
// }
