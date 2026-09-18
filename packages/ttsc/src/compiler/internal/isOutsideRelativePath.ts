import path from "node:path";

/**
 * Return `true` when a relative path escapes its base directory — i.e. starts
 * with `..` or is an absolute path. Used by callers that need to guard against
 * path traversal before building output keys or spawning subprocesses.
 */
export function isOutsideRelativePath(relative: string): boolean {
  return (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  );
}
