import type { TtscTransformResult } from "../TtscTransformResult";

/**
 * A transform result's code with its source map appended as an inline
 * `sourceMappingURL` comment.
 *
 * Esbuild's `onLoad` and Bun's plugin `onLoad` take only `contents`, with no
 * separate map. esbuild reads a trailing inline source map from loaded contents
 * and composes it into the bundle's map. A result without a map is returned as
 * its bare code.
 *
 * @param result The transform result to hand to a contents-only host.
 * @returns The contents to return from the host's `onLoad`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   JSON encoded as UTF-8 base64 gives contents-only hosts an inline v3 map;
 *   a line boundary prevents the directive from joining the final source line.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper adapts an already-validated result without owning map validation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The data URI and directive use source-map conventions, not host internals.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain why Bun/esbuild need an inline map and why absence
 *   returns bare code, with prose separated from tags per documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidence contracts/performance.md#efficient-algorithms
 *   With no map, returns the existing code. Otherwise one JSON serialization
 *   and UTF-8/base64 encoding cost linear time and temporary space in map
 *   size; appending the directive also accounts for the delivered code length.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function inlineSourceMap(result: TtscTransformResult): string {
  if (result.map === undefined) {
    return result.code;
  }
  const json = JSON.stringify(result.map);
  const separator = result.code.endsWith("\n") ? "" : "\n";
  return `${result.code}${separator}//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(json, "utf8").toString("base64")}\n`;
}
