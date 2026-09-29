/**
 * Minimal structural type for Next.js's `turbopack` configuration block.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Open configuration keys preserve caller settings while rules maps exact
 *   glob spellings to host-owned loader shorthand or conditional collections.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Unknown rule values preserve host shapes without duplicating its full rule schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The type exposes Turbopack's rule boundary rather than private build internals.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose identifies the host block and preserved settings; tag separation
 *   follows documentation guidance.
 */
export type TurbopackLikeConfig = Record<string, unknown> & {
  /** Per-glob loader rules. Other Turbopack settings are preserved untouched. */
  rules?: Record<string, unknown>;
};
