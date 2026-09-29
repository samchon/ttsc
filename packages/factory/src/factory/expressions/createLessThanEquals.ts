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
