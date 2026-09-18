import path from "node:path";

/**
 * Absolutize one graph string list (`globals`, `configs`), skipping members a
 * malformed envelope section may carry. Duplicates survive; the caller
 * deduplicates the merged list.
 */
export function selectListedFiles(
  projectRoot: string,
  listed: unknown,
): string[] {
  if (!Array.isArray(listed)) {
    return [];
  }
  const output: string[] = [];
  for (const entry of listed) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    output.push(path.resolve(projectRoot, entry));
  }
  return output;
}
