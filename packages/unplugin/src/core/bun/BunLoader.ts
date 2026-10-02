/**
 * Bun loader identifiers this adapter can emit (only TypeScript is matched).
 *
 * @evidence contracts/common.md#principled-implementation
 *   The ts/tsx union matches the shared source table's Bun loader values and
 *   preserves Bun's need to transpile transformed TypeScript before execution.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A literal union states the complete emitted loader domain directly.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   These are Bun protocol identifiers rather than guessed consumer names.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains why JavaScript loaders are absent and separates its
 *   description from the acknowledgments as documentation guidance requires.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   BunLoader only declares a shape; it has no filesystem, path or process
 *   operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   BunLoader only declares a shape; it has no computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   BunLoader only declares a shape; it has no work to reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   BunLoader only declares a shape; it has no handle or retained state at
 *   runtime.
 */
export type BunLoader = "ts" | "tsx";
