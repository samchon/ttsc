import type { OmittedExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link OmittedExpression}: an elided element, the hole left by a
 * missing entry in an array literal or binding pattern.
 *
 * The node carries no operand. The printer emits nothing for it; the
 * surrounding list still prints its comma separator, which is what produces the
 * visible gap.
 *
 * Placed before `a` in an array literal, the printer emits:
 *
 * ```ts
 * [, a]
 * ```
 *
 * @evidence contracts/common.md#principled-implementation A payload-free OmittedExpression represents a skipped array position whose enclosing commas carry the hole; it does not introduce an undefined value operand.
 * @evidence contracts/common.md#clear-and-simple-design Shared make constructs the only required discriminant, leaving list position and separators to its array owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit hole does not invent a binding or replace omission with a fixture-selected value.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the lack of operand and role of surrounding commas; the array-context example is separated from acknowledgment tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @returns The created {@link OmittedExpression}.
 */
export const createOmittedExpression = (): OmittedExpression =>
  make("OmittedExpression", {});
