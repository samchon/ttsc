import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `<=` operator: less-than-or-equal
 * comparison.
 *
 * Shorthand for {@link createBinaryExpression} with the `LessThanEqualsToken`
 * operator. Flat output uses spaces around it; width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a <= b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation LessThanEqualsToken preserves inclusive comparison with unchanged operands; its runtime coercion and result are not determined by node construction.
 * @evidence contracts/common.md#clear-and-simple-design The existing binary builder owns construction while this wrapper chooses the inclusive operator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Inclusive comparison remains one explicit operator rather than compensating logic around a strict comparison.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states the inclusive relation, parameter order and expression output with separate prose and tags under documentation guidance.
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
export const createLessThanEquals = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.LessThanEqualsToken, right);
