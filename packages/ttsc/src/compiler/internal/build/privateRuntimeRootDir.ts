import path from "node:path";

/**
 * Select the layout root for JavaScript written only to a runtime-owned emit
 * directory. Explicit roots and composite-project containment remain compiler
 * policy. An ordinary project without a root uses its native volume root so
 * adding private output does not reject same-volume imports outside the config
 * directory. A different Windows volume still cannot fit this one output root
 * and remains subject to the compiler's cross-volume layout diagnostics. This
 * changes only private output coordinates, not the program's input set. Actual
 * emitted-source provenance remains required before serving any file.
 *
 * @evidence contracts/common.md#principled-implementation Runtime-injected output has a separate layout root without widening an explicit or composite root or changing source membership and type options.
 * @evidence contracts/common.md#clear-and-simple-design One path policy is shared by compiler arguments and runtime ownership metadata.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No extra compiler pass, filename-derived emit authority or unchecked execution substitutes for the selected project and its actual output provenance.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes private output coordinates, explicit containment and actual source membership.
 * @evidence contracts/portability.md#os-neutral-implementation Node's native path parser preserves drive and UNC volume roots; explicit relative roots resolve against their declaring project. This selects lexical layout and makes no filesystem identity or case-policy observation.
 * @evidence contracts/performance.md#efficient-algorithms A fixed branch sequence delegates path parsing or resolution whose work and temporary strings scale with the supplied path text; no filesystem enumeration or compiler execution occurs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This path policy caches no completed or in-flight producer; callers own runtime generation reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only a returned path string transfers to the caller; no handle, generation or history is retained.
 */
export function privateRuntimeRootDir(
  projectRoot: string,
  rootDir: unknown,
  composite: unknown,
): string {
  if (typeof rootDir === "string") {
    return path.isAbsolute(rootDir)
      ? rootDir
      : path.resolve(projectRoot, rootDir);
  }
  return composite === true ? projectRoot : path.parse(projectRoot).root;
}
