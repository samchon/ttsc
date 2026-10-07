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
 *   ts/tsx are host parser protocol identifiers, carrying no native filename,
 *   case policy, process or filesystem capability.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The source-table selector owns extension matching; this union specifies
 *   the accepted emitted parser values without choosing a lookup strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Parser identifiers coordinate no completed/in-flight computation; source
 *   and generation owners decide actual cache reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Host parsers own execution resources; these literal values carry no handle,
 *   retained population or release operation.
 */
export type BunLoader = "ts" | "tsx";
