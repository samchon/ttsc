import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a signed right-shift expression: `left >> right`.
 *
 * Thin wrapper over {@link createBinaryExpression} with the `>>` operator. The
 * printer keeps the right operand on the operator's line instead of breaking
 * after it.
 *
 * With `left` of `a` and `right` of `b`, the printer emits:
 *
 * ```ts
 * a >> b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 * @evidence contracts/common.md#principled-implementation GreaterThanGreaterThanToken records signed right-shift syntax, preserving value and amount instead of substituting unsigned or division semantics.
 * @evidence contracts/common.md#clear-and-simple-design One shared binary-constructor call keeps shift representation common with other infix operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The signed-shift token is explicit, without input-selected masks or precomputed shift results.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies signed shifting and both operands; the expression example and tags are separate under documentation guidance.
 */
export const createRightShift = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.GreaterThanGreaterThanToken, right);
