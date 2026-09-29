import path from "node:path";

/**
 * Normalize the volume root of an absolute discovery identity.
 *
 * Physical spellings come from the supplied realpath operation. Keep native
 * names exact because an OS name cannot establish directory case sensitivity.
 * Windows drive and UNC roots normalize their case independently of child
 * names.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Realpath supplies physical name spelling; only the Windows volume root
 *   is folded, preserving distinct names in case-sensitive directories.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper owns discovery's identity-key spelling separately from
 *   directory traversal and from the filesystem operation that observes it.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Platform chooses only path-root syntax. Physical child spelling comes from
 *   realpath, and Windows names retain case independently of volume-root folding.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Name case is not guessed from an OS default; no foreign API is replaced.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states the input provenance and separate volume/name policies in
 *   paragraphs, following the documentation guidance for reasons and limits.
 */
export function canonicalProjectPath(
  location: string,
  platform: NodeJS.Platform | undefined,
): string {
  if ((platform ?? process.platform) !== "win32") return location;
  const root = path.win32.parse(location).root;
  return `${root.toLowerCase()}${location.slice(root.length)}`;
}
