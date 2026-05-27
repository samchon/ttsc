/**
 * Pick the most likely emitted JavaScript file from a compile result's output
 * map. Tries common paths first, then falls back to the first `.js` entry.
 * Returns null when no `.js` was emitted.
 */
export function pickEmittedJS(
  output: Record<string, string>,
  entryFile: string,
): string | null {
  const base = entryFile.replace(/\.[cm]?tsx?$/i, ".js");
  const candidates = [
    `dist/${base}`,
    `dist/src/${base}`,
    `src/${base}`,
    base,
  ];
  for (const key of candidates) {
    if (output[key] !== undefined) return output[key];
  }
  const jsKeys = Object.keys(output).filter((k) => k.endsWith(".js"));
  if (jsKeys.length > 0) return output[jsKeys[0]!] ?? null;
  return null;
}
