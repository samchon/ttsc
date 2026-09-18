import path from "node:path";

/**
 * Whether `file` is `root` itself or lies below it, lexically.
 *
 * Decided through `path.relative` so that a sibling directory sharing a name
 * prefix is never inside the root, and a path on another drive never is.
 */
export function containsPath(root: string, file: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}
