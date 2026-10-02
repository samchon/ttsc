import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `||` operator: logical OR with
 * short-circuit evaluation.
 *
 * Shorthand for {@link createBinaryExpression} with the `BarBarToken` operator.
 * Flat output surrounds the operator with spaces; width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a || b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation BarBarToken retains logical OR and short-circuit operand order; this builder does not reduce the operation to a boolean or evaluate either branch.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper selects OR through the common binary constructor with no separate fallback-value machinery.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Both operands remain explicit; no consumer-specific default replaces the supplied right expression.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states the short-circuit operation and operand positions, with separate expression example and tags under documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createLogicalOr = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.BarBarToken, right);
