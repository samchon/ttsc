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

/**
 * Whether a failed rename means the destination already exists. Windows
 * reports an occupied directory destination as `EACCES` or `EPERM`, so those
 * count only when the destination is actually present.
 */
export function isRenameDestinationOccupied(
  error: unknown,
  destination: string,
): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EEXIST" || code === "ENOTEMPTY") {
    return true;
  }
  return (code === "EACCES" || code === "EPERM") && fs.existsSync(destination);
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
