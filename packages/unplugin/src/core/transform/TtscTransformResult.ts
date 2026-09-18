import type { ITtscCompilerTransformation } from "ttsc";

/**
 * What the adapter's transform returns for a module it changed.
 *
 * A subset of unplugin's `TransformResult` object form, so every host adapter
 * can return it as is. It never takes the shorthand `string`, `null`, or `void`
 * forms, so callers always receive an object or `undefined`.
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
