import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create an unsigned right-shift expression: `left >>> right`.
 *
 * Thin wrapper over {@link createBinaryExpression} with the `>>>` operator.
 *
 * With `left` of `a` and `right` of `b`, the printer emits:
 *
 * ```ts
 * a >>> b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation GreaterThanGreaterThanGreaterThanToken records unsigned right shift with value/amount order; runtime numeric restrictions remain outside this syntax builder.
 * @evidence contracts/common.md#clear-and-simple-design The longer operator spelling still uses one binary constructor rather than a separate unsigned-shift node schema.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsigned semantics follow the explicit token, not a mask added to compensate for signed-shift output.
 * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes unsigned shifting and ordered operands; example and acknowledgment tags remain separate under documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createUnsignedRightShift = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(
    left,
    SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
    right,
  );
