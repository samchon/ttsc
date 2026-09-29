import fs from "node:fs";

/**
 * Whether a cache entry exists, including a dangling symlink or junction.
 *
 * @evidence contracts/common.md#principled-implementation lstat observes the terminal entry without following a dangling link; only missing entry or missing ancestor means false, while other filesystem errors propagate.
 * @evidence contracts/common.md#clear-and-simple-design One native observation and one missing-error branch expose existence without duplicating physical identity or cleanup policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Permission and I/O failures are not converted into assumed absence; no foreign filesystem method is replaced.
 * @evidence contracts/common.md#meaningful-documentation Native wording explicitly includes dangling aliases, the nonobvious distinction needed by cleanup callers, and tags occupy their own block.
 * @evidence contracts/portability.md#os-neutral-implementation Node lstat carries native terminal-link semantics and normalized missing errno rather than inferring existence from path spelling or OS names.
 */
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
