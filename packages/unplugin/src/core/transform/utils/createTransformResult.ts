import type { TtscTransformResult } from "../TtscTransformResult";
import type { TtscTransformedOutput } from "../envelope/TtscTransformedOutput";
import { resolveTransformSourceMap } from "./resolveTransformSourceMap";

/**
 * Build the unplugin transform result, or `undefined` when the transform
 * produced no changes.
 *
 * Returning `undefined` instead of `{ code: source }` lets the bundler skip the
 * unnecessary module update and preserves the original source map. A changed
 * module carries the envelope's source map when it describes the delivered
 * text, so the bundler can map the transformed text back to the author's lines.
 * Otherwise it carries none rather than a map that would point at the wrong
 * lines.
 *
 * @param file Absolute path of the transformed module.
 * @param source Text the bundler delivered for the module.
 * @param output The envelope's entry for the module.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Equal delivered/emitted text needs no update; changed text carries a map
 *   only after its source content is matched to what this host delivered.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The operation owns the optional result shape and delegates map validation
 *   to resolveTransformSourceMap rather than mixing host-specific map policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Dropping an unverifiable map preserves the existing mapless contract;
 *   it does not substitute fabricated locations to satisfy a known example.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain no-change and mismatched-source effects, and
 *   tagged parameters follow the documentation guidance's prose separation.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The absolute native module path is passed to the shared map resolver,
 *   which resolves sources and observes actual filesystem aliases and case
 *   policy before emitting forward-slash source-map paths.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Equal code avoids map processing entirely. Changed code compares supplied
 *   text and, when a map exists, delegates one source-list normalization and
 *   identity search; cost grows with text and source-path lengths and native
 *   identity observations, rather than remaining constant at this wrapper.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function createTransformResult(
  file: string,
  source: string,
  output: TtscTransformedOutput,
): TtscTransformResult | undefined {
  if (source === output.code) {
    return undefined;
  }
  const map =
    output.map === undefined
      ? undefined
      : resolveTransformSourceMap(file, source, output.map);
  return map === undefined ? { code: output.code } : { code: output.code, map };
}
