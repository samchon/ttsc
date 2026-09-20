import path from "node:path";

/**
 * The directory below a project where the adapter keeps the files it asks a
 * host to watch: the watch bridge's sentinels and Turbopack's process marker
 * (samchon/ttsc#1457).
 *
 * Every host constrains where such a file may live, and `<root>/.ttsc` is the
 * one place that satisfies all of them, measured on each:
 *
 * - Turbopack fails a module whose dependency leaves its project filesystem root,
 *   so the file must be inside the project.
 * - Farm computes every watch file's path relative to its root and fails on one
 *   it cannot relate, such as a file on another Windows drive; its watcher
 *   ignores `node_modules` inside the root and refuses an extra file below any
 *   `node_modules`, so the file must be inside the root and outside them.
 * - Webpack and Rspack watch a dependency's directory through `fs.watch`, and
 *   libuv's Windows backend aborts the host on a directory spelled with a short
 *   name, which the system temporary directory routinely is
 *   (`C:\Users\RUNNER~1\...`), so the file must be spelled as the project is.
 *
 * The system temporary directory, the previous default, met none of the three
 * on Windows. `.ttsc` is ttsc's own project-local directory, already excluded
 * from project discovery, and everything the adapter writes there is named by
 * the owning process and removed when it exits or by the next bridge to start.
 */
export function hostToolDirectory(root: string): string {
  return path.join(root, ".ttsc");
}
