import fs from "node:fs";

/**
 * Whether native stat observes a regular input with multiple links. A failed
 * stat returns false; it does not prove the absence of hardlink aliases.
 *
 * @evidence contracts/common.md#principled-implementation An observed regular file with more than one native link has possible write aliases outside its watched spelling; false includes unavailable metadata and is not an alias-free content proof.
 * @evidence contracts/common.md#clear-and-simple-design A single stat inspects file kind and link count, leaving conservative validation and polling policy to the observer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The native link count is not guessed from names; an unreadable stat does not fabricate a verified content baseline.
 * @evidence contracts/common.md#meaningful-documentation The comment connects multiple links to unobserved write aliases, which explains the consumer's fallback polling.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral topology discovery reads the observed filesystem's native stat/link count rather than assuming link capability or identity from platform names.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources statSync returns before the function does; no handle is retained.
 * @evidence contracts/performance.md#efficient-algorithms One following native stat classifies kind and link count without reading bytes or enumerating aliases; its path-component/link resolution cost belongs to the native operation, not the fixed predicate count.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The link count decides polling and must be read now; nothing is shared.
 */
export function hasMultipleLinks(file: string): boolean {
  try {
    const stats = fs.statSync(file);
    return stats.isFile() && stats.nlink > 1;
  } catch {
    return false;
  }
}
