/**
 * Read a `compilerOptions.paths` value into a clean mapping, dropping every
 * malformed part instead of failing.
 *
 * A non-object value yields no mappings, a non-array entry is skipped, and a
 * target list keeps only its strings. The compiler owns the diagnostic for a
 * malformed configuration; this reader only has to avoid forwarding garbage
 * into the generated overlay.
 */
export function readPaths(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const output: Record<string, string[]> = {};
  for (const [key, paths] of Object.entries(value)) {
    if (!Array.isArray(paths)) {
      continue;
    }
    const filtered = paths.filter(
      (entry): entry is string => typeof entry === "string",
    );
    if (filtered.length !== 0) {
      output[key] = filtered;
    }
  }
  return output;
}
