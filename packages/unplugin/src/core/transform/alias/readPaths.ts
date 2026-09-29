/**
 * Read a `compilerOptions.paths` value into a clean mapping, dropping every
 * malformed part instead of failing.
 *
 * A non-object value yields no mappings, a non-array entry is skipped, and a
 * target list keeps only its strings. The compiler owns the diagnostic for a
 * malformed configuration; this reader only has to avoid forwarding garbage
 * into the generated overlay.
 *
 * @evidence contracts/common.md#principled-implementation Only nonempty string target lists are forwarded; an ordered Map preserves declaration order and represents arbitrary compiler keys such as __proto__ as own mapping entries.
 * @evidence contracts/common.md#clear-and-simple-design One input guard and one entry pass project the representable mapping without adding configuration diagnostics or another parser.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Malformed values are not invented into targets, and dynamic keys cannot alter the returned object's prototype or disappear silently.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state every dropped representation and explicitly leave malformed-configuration diagnostics with the compiler.
 */
export function readPaths(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const output = new Map<string, string[]>();
  for (const [key, paths] of Object.entries(value)) {
    if (!Array.isArray(paths)) {
      continue;
    }
    const filtered = paths.filter(
      (entry): entry is string => typeof entry === "string",
    );
    if (filtered.length !== 0) {
      output.set(key, filtered);
    }
  }
  return Object.fromEntries(output);
}
