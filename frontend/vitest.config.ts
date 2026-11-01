import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // tsconfig keeps JSX for Next; tests that render a component need it compiled.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    // Mirror tsconfig path alias "@/*": ["./*"]
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts'],
  },
});
