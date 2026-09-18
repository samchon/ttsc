import path from "node:path";

/**
 * Whether `child` is `parent` itself or lies below it, lexically.
 *
 * Decided through `path.relative`, never by string prefix, so a sibling such as
 * `/repo2` is not inside `/repo` and a path on another drive or share is never
 * inside anything local.
 */
export function pathIsWithin(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}
