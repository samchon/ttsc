import path from "node:path";

import type { ResolvedTtscUnpluginOptions } from "../options/ResolvedTtscUnpluginOptions";
import { hashText } from "../transform/utils/hashText";
import { stableStringify } from "../transform/utils/stableStringify";

/**
 * The identity of the options a delivery to Rollup was compiled under, which
 * the module carries into Rollup's cache (`TtscRollupDelivery`).
 *
 * Rollup's cache keys a module by its source alone, so a module compiled under
 * other options, another `project`, compiler-options overlay, plugin list, or
 * set of aliases, is served as it is unless the adapter asks for it again. The
 * identity is what a generation's key holds (`createTransformCacheKey`) but the
 * tsconfig, which the record a delivery names stands for, with the `project`
 * option resolved as the selection resolves it, so it is one string for one
 * configuration in every process.
 *
 * @param options The plugin instance's resolved options.
 * @param aliasPaths The aliases the compile is handed (`createAliasPaths`).
 */
export function rollupDeliveryOptions(
  options: ResolvedTtscUnpluginOptions,
  aliasPaths: Record<string, string[]>,
): string {
  return hashText(
    stableStringify({
      aliasPaths,
      compilerOptions: options.compilerOptions,
      plugins: options.plugins,
      project:
        options.project === undefined ? null : path.resolve(options.project),
    }),
  );
}
