import fs from "node:fs";

/**
 * Record a use of a single-file cache entry by setting its modification time,
 * which `pruneCacheFileRoot` reads as its last use. A hit
 * that cannot record it still answers: the entry may then age out a use early
 * and be computed again.
 *
 * Pre-existing symbolic or multiply linked entries are left untouched so a
 * restored cache cannot refresh an unrelated inode's usage metadata.
 *
 * @evidence contracts/common.md#principled-implementation A successful cache hit advances the file's mtime used by age/LRU pruning; a failed refresh cannot invalidate an already obtained answer.
 * @evidence contracts/common.md#clear-and-simple-design This helper changes only usage metadata and leaves answer validation to the reader and eviction to the collector.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual hit usage drives the timestamp, without recognized keys, expected answers or foreign API patches.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain failed-refresh consequences and pre-existing alias rejection without confusing usage metadata with answer validity.
 * @evidence contracts/portability.md#os-neutral-implementation Node utimes uses native file timestamp semantics; callers supply an owned cache entry and failures are tolerated rather than assuming a platform's open-file permissions.
 * @evidence contracts/performance.md#efficient-algorithms One metadata update avoids rewriting cached answer bytes on every hit.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The owning reader validates equivalent answers; this helper merely records a completed hit.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Usage updates postpone age eviction under the collector's size/protection policy; no open handle is retained here.
 */
export function recordCacheFileUse(file: string): void {
  try {
    const stats = fs.lstatSync(file);
    // A restored cache can contain aliases to an unrelated inode. Do not
    // refresh their metadata merely because a reader obtained a valid answer.
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1) return;
    const now = new Date();
    fs.utimesSync(file, now, now);
  } catch {
    // The entry was removed or cannot be touched; the answer stands.
  }
}
