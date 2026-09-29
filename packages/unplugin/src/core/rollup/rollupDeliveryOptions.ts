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
 * Compiler options, plugin payloads and alias mappings preserve their actual
 * JSON order. Their consumers can observe declaration order; the host cannot
 * claim equivalence merely by sorting arbitrary configuration keys.
 *
 * @param options The plugin instance's resolved options.
 * @param aliasPaths The aliases the compile is handed (`createAliasPaths`).
 *
 * @evidence contracts/common.md#principled-implementation Project selection and opaque JSON of the compiler overlay, plugin payloads and alias mappings identify delivered compile options without erasing declaration order observable by the compiler or plugin.
 * @evidence contracts/common.md#clear-and-simple-design The identity reuses the common serializer and hash helper, leaving tsconfig input state to the project record.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Resolving the configured project follows actual selection spelling; no target-specific exception drops relevant compile options.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain why Rollup requires option identity and why the record owns tsconfig state separately.
 */
export function rollupDeliveryOptions(
  options: ResolvedTtscUnpluginOptions,
  aliasPaths: Record<string, string[]>,
): string {
  return hashText(
    stableStringify({
      aliasPaths: JSON.stringify(aliasPaths),
      compilerOptions: JSON.stringify(options.compilerOptions),
      plugins: JSON.stringify(options.plugins),
      project:
        options.project === undefined ? null : path.resolve(options.project),
    }),
  );
}
