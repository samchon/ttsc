/** Normalize one directory entry under the owning filesystem's case policy. */
export function normalizeHostInputName(
  name: string,
  caseSensitive: boolean,
): string {
  return caseSensitive ? name : name.toLowerCase();
}
