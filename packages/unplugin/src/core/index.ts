import type { UnpluginFactory, UnpluginInstance } from "unplugin";
import { createUnplugin } from "unplugin";

import type { TtscUnpluginOptions } from "./options";
import { resolveOptions } from "./options";
import {
  createTtscTransformCache,
  isDeclarationFile,
  stripQuery,
  transformTtsc,
} from "./transform";

const name = "ttsc-unplugin";
/**
 * Matches any TypeScript or JavaScript source extension (.ts, .tsx, .mts, .cts,
 * etc.). Shared with the Bun adapter (`bun.ts`) so the filter is defined once
 * and both adapters stay in sync.
 */
export const sourceFilePattern = /\.[cm]?tsx?$/;
/** Matches any path segment that is a `node_modules` directory (cross-platform). */
const nodeModulesPattern = /(?:^|[/\\])node_modules(?:[/\\]|$)/;
/**
 * Matches virtual module ids — Rollup/Vite use a leading NUL byte (`\0`) as
 * convention.
 */
const virtualModulePattern = /\0/;

/**
 * Unplugin factory that wires the ttsc transform pipeline into any supported
 * bundler (Vite, Rollup, Rolldown, webpack, Rspack, esbuild, Farm).
 *
 * The factory resolves raw options once, creates a per-build transform cache,
 * and captures Vite alias configuration via the `vite.configResolved` hook so
 * that path aliases are forwarded to the generated tsconfig overlay. The cache
 * is cleared on every `buildStart` to avoid stale results across watch-mode
 * rebuilds.
 */
const unpluginFactory: UnpluginFactory<
  TtscUnpluginOptions | undefined,
  false
> = (rawOptions = {}) => {
  const options = resolveOptions(rawOptions);
  const transformCache = createTtscTransformCache();
  let aliases: unknown;

  return {
    name,
    enforce: "pre",

    vite: {
      configResolved(config) {
        aliases = config.resolve.alias;
      },
    },

    buildStart() {
      transformCache.clear();
    },

    transformInclude(id) {
      const file = stripQuery(id);
      return isTransformTarget(file);
    },

    async transform(source, id) {
      const file = stripQuery(id);
      if (!isTransformTarget(file)) {
        return undefined;
      }
      return transformTtsc(file, source, options, aliases, transformCache, {
        // Register plugin-reported dependencies (the transform envelope's
        // `dependencies` lists) so type-only inputs invalidate this module
        // in watch mode; bundlers erase type-only imports from their own
        // module graph and would otherwise serve stale generated code.
        addWatchFile: (watched) => this.addWatchFile(watched),
      });
    },
  };
};

const unplugin: UnpluginInstance<TtscUnpluginOptions | undefined, false> =
  createUnplugin(unpluginFactory);

export type {
  TtscUnpluginCompilerOptionsJson,
  TtscUnpluginOptions,
} from "./options";
export type { TtscTransformHooks } from "./transform";
export { createTtscTransformCache, resolveOptions, transformTtsc, unplugin };

export default unplugin;

/**
 * Returns `true` when the module id refers to a real TypeScript/JavaScript
 * source file that should be processed by the ttsc transform.
 *
 * Excluded ids: virtual modules (NUL prefix), `.d.ts` declaration files, and
 * anything inside `node_modules`.
 */
function isTransformTarget(id: string): boolean {
  return (
    sourceFilePattern.test(id) &&
    !virtualModulePattern.test(id) &&
    !isDeclarationFile(id) &&
    !nodeModulesPattern.test(id)
  );
}
