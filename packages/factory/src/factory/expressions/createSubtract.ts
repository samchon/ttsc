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
 */
export const createSubtract = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.MinusToken, right);
