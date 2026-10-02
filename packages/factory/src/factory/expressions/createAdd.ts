import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `+` operator: addition or string
 * concatenation.
 *
 * Shorthand for {@link createBinaryExpression} with the `PlusToken` operator.
 * Flat output surrounds the operator with spaces; width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a + b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation PlusToken with unchanged ordered operands represents addition or concatenation syntax; operand types determine its runtime meaning, not this builder.
 * @evidence contracts/common.md#clear-and-simple-design One delegation selects + while the shared binary builder owns the node shape and the printer owns precedence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fixed plus token is this helper's documented operation, not a special consumer or expected sum.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains both plus meanings, shared construction and operand roles; the expression example and tags are separate under documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createAdd = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.PlusToken, right);
