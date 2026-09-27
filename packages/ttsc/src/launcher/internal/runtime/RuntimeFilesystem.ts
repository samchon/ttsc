import fs from "node:fs";

/**
 * Filesystem predicates the runtime hooks and the dependency lock share.
 *
 * They answer the same questions for every caller, so "missing" and "occupied"
 * mean one thing across the lock protocol and the serve lanes.
 */
export namespace RuntimeFilesystem {
  /** Whether an error means the path, or one of its parents, does not exist. */
  export function isMissingPathError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ENOTDIR";
  }

  /** Whether `candidate` exists and is a regular file, following links. */
  export function isFile(candidate: string): boolean {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  }
}
