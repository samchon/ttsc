import type { BunRuntimeGlobal } from "./BunRuntimeGlobal";

/**
 * The Bun runtime global when the current process runs under Bun, detected by a
 * callable `Bun.plugin`.
 *
 * @returns `undefined` off Bun, which lets the import-time registration stay a
 *   silent no-op under Node while an explicit `register` call throws.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Requiring a present callable plugin member detects the capability this
 *   registration needs without assuming that every process exposes Bun.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One detector returns the structural registration boundary or absence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   It reads the host capability and does not replace any global or method.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains why absence is returned and how import-time and explicit
 *   callers differ, with native tag spacing following documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function bunRuntime(): BunRuntimeGlobal | undefined {
  const runtime = (globalThis as { Bun?: BunRuntimeGlobal }).Bun;
  return runtime !== undefined && typeof runtime.plugin === "function"
    ? runtime
    : undefined;
}
