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
 * text, so the bundler can map the transformed text back to the author's lines
 * (samchon/ttsc#1392). Otherwise it carries none, exactly as before maps
 * existed, rather than a map that would point at the wrong lines.
 *
 * @param file Absolute path of the transformed module.
 * @param source Text the bundler delivered for the module.
 * @param output The envelope's entry for the module.
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
