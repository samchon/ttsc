/**
 * Type shape returned by `getTypeAtPosition`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Printed text and native flag bits project the checker result through JSON
 *   without exposing Go checker objects or an incomplete parallel type model.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Printed text and native flags provide presentation and classification in a
 *   small value; structural compiler types remain owned by the native checker.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   TypeToString is the presentation authority; the consumer need not infer
 *   a type from source spelling or a manually maintained flag lookup.
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc names the native printing API and flag provenance, following
 *   the documentation skill's concrete context guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscTypeInfo is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscTypeInfo is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscTypeInfo is a data interface and coordinates no shared or repeated computation.
 */
export interface ITtscTypeInfo {
  /** Printed type, equivalent to TypeScript's `TypeToString(t)`. */
  text: string;

  /** Numeric `TypeFlags` bitmask from TypeScript-Go. */
  flags: number;
}
