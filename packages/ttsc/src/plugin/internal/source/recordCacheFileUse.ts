import fs from "node:fs";

/**
 * Record a use of a single-file cache entry by setting its modification time,
 * which `pruneCacheFileRoot` reads as its last use (samchon/ttsc#1562). A hit
 * that cannot record it still answers: the entry may then age out a use early
 * and be computed again.
 */
export function recordCacheFileUse(file: string): void {
  try {
    const now = new Date();
    fs.utimesSync(file, now, now);
  } catch {
    // The entry was removed or cannot be touched; the answer stands.
  }
}
