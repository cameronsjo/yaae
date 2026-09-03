/**
 * `?raw` imports resolve to the file's raw text: Vite/vitest support the
 * query natively; esbuild mirrors it via the rawImports plugin in
 * esbuild.config.mjs. Used for print CSS injected via <style> at runtime.
 */
declare module '*.css?raw' {
  const css: string;
  export default css;
}
