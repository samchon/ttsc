import path from "node:path";

/** Report whether `child` equals `parent` or is nested beneath it. */
export function isPathWithin(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel))
  );
}
