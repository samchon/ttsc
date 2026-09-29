import path from "node:path";

/**
 * The directory below a host's root where the adapter keeps the files it asks
 * the host to watch: the project records (samchon/ttsc#1457).
 *
 * Every host constrains where such a file may live, and `<root>/.ttsc` is the
 * one place that satisfies all of them, measured on each:
 *
 * - Turbopack fails a module whose dependency leaves its project filesystem root,
 *   so the file must be inside the root Turbopack resolved.
 * - Farm computes every watch file's path relative to its root and fails on one
 *   it cannot relate, such as a file on another Windows drive; its watcher
 *   ignores `node_modules` inside the root and refuses an extra file below any
 *   `node_modules`, so the file must be on the root's drive and outside them,
 *   and it lives below Farm's configured root rather than the directory Farm
 *   runs in, which a configuration can place on another drive.
 * - Webpack and Rspack watch a dependency's directory through `fs.watch`, and
 *   libuv's Windows backend aborts the host on a directory spelled with a short
 *   name, which the system temporary directory routinely is
 *   (`C:\Users\RUNNER~1\...`), so the file must be spelled as the host's root
 *   is.
 *
 * The system temporary directory, the previous default, met none of the three
 * on Windows. `.ttsc` is ttsc's own project-local directory, already excluded
 * from project discovery. The adapter keeps the project records there alone
 * (`PROJECT_RECORD_DIRECTORY`), under a stable name, since a host's persistent
 * cache records them as dependencies and they outlive every process.
 *
 * @param root The host's root: the directory the host runs in for the unplugin
 *   adapters and the Next wrapper, Farm's configured root for Farm,
 *   `absWorkingDir` for esbuild, and the root Turbopack resolved
 *   (`rootContext`) for its loader.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Native join locates the package-owned .ttsc directory under the actual host
 *   root, satisfying dependency-root restrictions without relocating watched paths.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One helper owns the project-local directory convention shared by host adapters.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   .ttsc is the product's directory convention; host-specific roots implement
 *   actual dependency acceptance rules rather than consumer path exceptions.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain native watched-directory constraints and root
 *   meaning for each adapter, with tag separation per documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Node's native join preserves the actual host root's volume and spelling; records stay under that root to satisfy filesystem-root, same-drive and Windows watched-directory constraints.
 */
export function hostToolDirectory(root: string): string {
  return path.join(root, ".ttsc");
}
