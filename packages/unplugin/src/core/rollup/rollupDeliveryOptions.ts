import path from "node:path";

import type { ResolvedTtscUnpluginOptions } from "../options/ResolvedTtscUnpluginOptions";
import { hashText } from "../transform/utils/hashText";
import { stableStringify } from "../transform/utils/stableStringify";

/**
 * The identity of the options a delivery to Rollup was compiled under, which
 * the module carries into Rollup's cache (`TtscRollupDelivery`).
 *
 * The identity records alias mappings, compiler overlay, plugin payloads and
 * configured project selection. Tsconfig input state is represented separately
 * by the delivery's project record. A configured project resolves under the
 * same native cwd rule as explicit selection; it is not canonicalized to a
 * physical alias or made process-independent across different cwd spellings.
 *
 * Compiler options, plugin payloads and alias mappings preserve their actual
 * JSON order. Their consumers can observe declaration order; the host cannot
 * claim equivalence merely by sorting arbitrary configuration keys.
 *
 * @param options The plugin instance's resolved options.
 * @param aliasPaths The aliases the compile is handed (`createAliasPaths`).
 * @evidence contracts/common.md#principled-implementation Project selection and opaque JSON of the compiler overlay, plugin payloads and alias mappings identify delivered compile options without erasing declaration order observable by the compiler or plugin.
 * @evidence contracts/common.md#clear-and-simple-design The identity reuses the common serializer and hash helper, leaving tsconfig input state to the project record.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Resolving the configured project follows actual selection spelling; no target-specific exception drops relevant compile options.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain why Rollup requires option identity and why the record owns tsconfig state separately.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Resolves options.project with node:path, so separators and roots follow
 *   the host OS.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Three opaque JSON payloads are encoded before a fixed-key outer encoding
 *   and hash pass. Payload entries/emitted bytes, escaping and native project
 *   anchor lengths drive traversal and temporary strings, not wrapper count.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This one identity computation coordinates no cross-call work. The plugin
 *   instance owns reuse for its fixed options and supplied alias identity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
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
