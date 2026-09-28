import fs from "node:fs";

/** Whether a cache entry exists, including a dangling symlink or junction. */
export function cacheEntryExists(location: string): boolean {
  try {
    fs.lstatSync(location);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return false;
    throw error;
  }
}
