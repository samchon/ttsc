import type { TtscTransformResult } from "../TtscTransformResult";

/**
 * A transform result's code with its source map appended as an inline
 * `sourceMappingURL` comment (samchon/ttsc#1392).
 *
 * Esbuild's `onLoad` and Bun's plugin `onLoad` take only `contents`, with no
 * separate map. esbuild reads a trailing inline source map from loaded contents
 * and composes it into the bundle's map. A result without a map is returned as
 * its bare code.
 *
 * @param result The transform result to hand to a contents-only host.
 * @returns The contents to return from the host's `onLoad`.
 */
export function inlineSourceMap(result: TtscTransformResult): string {
  if (result.map === undefined) {
    return result.code;
  }
  const json = JSON.stringify(result.map);
  const separator = result.code.endsWith("\n") ? "" : "\n";
  return `${result.code}${separator}//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(json, "utf8").toString("base64")}\n`;
}
