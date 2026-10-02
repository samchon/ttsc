import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a strict equality expression: `left === right`.
 *
 * Thin wrapper over {@link createBinaryExpression} with the `===` operator.
 *
 * With `left` of `a` and `right` of `b`, the printer emits:
 *
 * ```ts
 * a === b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation EqualsEqualsEqualsToken retains strict equality with unchanged operands rather than introducing coercive comparison semantics.
 * @evidence contracts/common.md#clear-and-simple-design The binary constructor supplies the comparison outline; the wrapper's sole policy is strict operator selection.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit strict operator does not depend on a known fixture's values or a fabricated comparison result.
 * @evidence contracts/common.md#meaningful-documentation Native prose names strict equality and describes ordered operands; its example and tag block remain distinct under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createStrictEquality = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.EqualsEqualsEqualsToken, right);
