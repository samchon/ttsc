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
 */
export type BunLoader = "ts" | "tsx";
