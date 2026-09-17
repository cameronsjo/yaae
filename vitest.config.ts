import { defineConfig } from "vitest/config";
import { readFile } from "node:fs/promises";
import path from "path";

/**
 * Serve `*.css?raw` imports as raw text, mirroring the esbuild rawImports
 * plugin. Vitest's CSS handling matches any id whose extension is .css
 * (query-stripped) and reduces it to an empty module — so the virtual id
 * mangles the extension (.css → .rawcss) to stay out of that pipeline.
 */
function rawCssForTests() {
  const PREFIX = "\0raw-css:";
  return {
    name: "yaae-raw-css",
    enforce: "pre" as const,
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith(".css?raw") || !importer) return null;
      const file = path.resolve(
        path.dirname(importer),
        source.slice(0, -"?raw".length),
      );
      return PREFIX + file.replace(/\.css$/, ".rawcss");
    },
    async load(id: string) {
      if (!id.startsWith(PREFIX)) return null;
      const file = id.slice(PREFIX.length).replace(/\.rawcss$/, ".css");
      const css = await readFile(file, "utf-8");
      return `export default ${JSON.stringify(css)};`;
    },
  };
}

export default defineConfig({
  plugins: [rawCssForTests()],
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "bench/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    benchmark: {
      include: ["bench/**/*.bench.ts"],
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, "tests/__mocks__/obsidian.ts"),
    },
  },
});
