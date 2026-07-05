/**
 * esbuild bundles .css imports as raw text (loader: { '.css': 'text' });
 * vitest mirrors this via the transform plugin in vitest.config.ts.
 */
declare module '*.css' {
  const css: string;
  export default css;
}
