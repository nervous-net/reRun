// ABOUTME: Vitest configuration for reRun test suite
// ABOUTME: Handles both server (Node) and client (jsdom) test environments

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environmentMatchGlobs: [
      ['tests/client/**', 'jsdom'],
    ],
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, 'server'),
      '@client': path.resolve(__dirname, 'client/src'),
    },
  },
});
