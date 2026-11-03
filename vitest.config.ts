import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /.*\/src\/core\/(.*)/,
        replacement: path.resolve(__dirname, 'src/core/$1'),
      },
      {
        find: /.*\/src\/core$/,
        replacement: path.resolve(__dirname, 'src/core'),
      },
    ],
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
});
