import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    // e2e tests need a database; keep them serial.
    fileParallelism: false,
    testTimeout: 20000,
  },
  esbuild: {
    target: 'es2022',
  },
});
