/**
 * Fold one absolute directory spelling into the key discovery compares.
 *
 * Windows paths are case-insensitive, so two spellings of one directory must
 * collapse to one key or a linked traversal could visit the same project twice
 * and never recognize the cycle. Every other platform keeps the spelling as is:
 * a case-sensitive volume can hold two distinct directories whose names differ
 * only in case.
 */
export function canonicalProjectPath(
  location: string,
  platform: NodeJS.Platform | undefined,
): string {
  return platform === "win32" ? location.toLowerCase() : location;
}
