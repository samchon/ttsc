import path from "node:path";

/** Absolute path of a fixture graph member, for expectation lists. */
export function member(root: string, relative: string): string {
  return path.join(root, ...relative.split("/"));
}
