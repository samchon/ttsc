import type { ITtscCompilerTransformation } from "ttsc";

/**
 * What the adapter's transform returns for a module it changed.
 *
 * A subset of unplugin's `TransformResult` object form, so every host adapter
 * can return it as is. It never takes the shorthand `string`, `null`, or `void`
 * forms, so callers always receive an object or `undefined`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Required code and an optional v3 map express changed program text with only
 *   provenance-validated mapping; absence of a whole result represents no change.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One object shape works for structured hosts and contents-only adapters
 *   without spreading unplugin's shorthand variants into callers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A missing map is represented honestly rather than by fabricated mappings.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs distinguish result absence from map absence; spaced member
 *   comments explain source provenance per documentation guidance.
 */
export interface TtscTransformResult {
  /** Transformed TypeScript text of the module. */
  code: string;

  /**
   * Source map from {@link code} back to the text the bundler delivered, with
   * absolute `sources`. Absent when the envelope carried no map that describes
   * the delivered text (samchon/ttsc#1392).
   */
  map?: ITtscCompilerTransformation.ISourceMap;
}
