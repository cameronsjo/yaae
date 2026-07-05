import { defineConfig } from 'vitest/config';
import { readFile } from 'node:fs/promises';
import path from 'path';

/**
 * Mirror esbuild's `loader: { '.css': 'text' }`: .css imports resolve to the
 * raw file content as a string, so tests exercise the same bundled CSS the
 * plugin injects at runtime.
 */
function cssAsText() {
  return {
    name: 'yaae-css-as-text',
    enforce: 'pre' as const,
    async load(id: string) {
      if (!id.endsWith('.css')) return null;
      const css = await readFile(id, 'utf-8');
      return `export default ${JSON.stringify(css)};`;
    },
  };
}

export default defineConfig({
  plugins: [cssAsText()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, 'tests/__mocks__/obsidian.ts'),
    },
  },
});
