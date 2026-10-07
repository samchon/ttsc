import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a subtraction expression: `left - right`.
 *
 * Thin wrapper over {@link createBinaryExpression} with the `-` operator.
 *
 * With `left` of `a` and `right` of `b`, the printer emits:
 *
 * ```ts
 * a - b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 * @evidence contracts/common.md#principled-implementation MinusToken preserves minuend/subtrahend order as subtraction syntax, without converting the expressions to numbers in the builder.
 * @evidence contracts/common.md#clear-and-simple-design One binary-builder delegation captures subtraction; it does not rewrite the operation into addition plus unary negation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The minus token represents the named operation, not a correction constant or known difference.
 * @evidence contracts/common.md#meaningful-documentation Native prose states subtraction and operand order, with an expression example separated from tags following documentation guidance.
 */
export const createSubtract = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.MinusToken, right);
