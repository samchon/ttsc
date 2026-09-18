import { fileURLToPath } from "node:url";

/**
 * Absolute path of the loader module {@link restoreTtscSourceMap} ships in, as
 * webpack and Rspack take a loader.
 *
 * Always the CommonJS build beside this module, which both hosts can `require`.
 * Rollup rewrites `import.meta.url` for the CommonJS and ES module builds
 * alike, so the path names this copy of the package however the host loaded it,
 * never a copy some other resolution would find.
 */
export const TTSC_SOURCE_MAP_LOADER: string = fileURLToPath(
  new URL("./restoreTtscSourceMapLoader.js", import.meta.url),
);
