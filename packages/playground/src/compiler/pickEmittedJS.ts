/**
 * Pick the most likely emitted JavaScript file from a compile result's output
 * map. Tries the default playground layout (`rootDir` `src`, `outDir` `dist`,
 * which emits `dist/playground.js` for `src/playground.ts`) and other common
 * paths first, then falls back to the first `.js` entry. Returns null when no
 * `.js` was emitted.
 *
 * @evidence contracts/common.md#principled-implementation The first candidate is the default playground layout (the entry's path below the default `src` root under `dist`), the others cover layouts rooted at the project; the first remaining JavaScript entry is an explicitly heuristic fallback, not a general entrypoint solver.
 * @evidence contracts/common.md#clear-and-simple-design A small selector separates UI output choice from compiler emit configuration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Layout candidates are product defaults rather than fixture filenames, and absent JavaScript remains null.
 * @evidence contracts/common.md#meaningful-documentation Native prose honestly documents priority and heuristic fallback, separated from tags under the documentation skill.
 * @evidence contracts/performance.md#efficient-algorithms Five indexed candidate checks precede an O(output keys) fallback that stops at the first JavaScript key; it does not allocate a second array of every matching output.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This selector consumes one caller-owned emit map and does not coordinate repeated builds or shared results.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It retains no state or handles and returns text already owned by the output map.
 */
export function pickEmittedJS(
  output: Record<string, string>,
  entryFile: string,
): string | null {
  const base = entryFile.replace(/\.[cm]?tsx?$/i, ".js");
  // `buildTsconfigJSON` roots sources at `src` and emits to `dist`, so the
  // default entry `src/playground.ts` is reported as `dist/playground.js`.
  const underSrcRoot = base.replace(/^src\//, "");
  const candidates = [
    `dist/${underSrcRoot}`,
    `dist/${base}`,
    `dist/src/${base}`,
    `src/${base}`,
    base,
  ];
  for (const key of candidates) {
    if (output[key] !== undefined) return output[key];
  }
  for (const key of Object.keys(output)) {
    if (key.endsWith(".js")) return output[key] ?? null;
  }
  return null;
}
