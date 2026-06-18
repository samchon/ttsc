import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `<<` operator: bitwise left shift.
 *
 * Shorthand for {@link createBinaryExpression} with the `LessThanLessThanToken`
 * operator. The printer surrounds the operator with a single space on each
 * side.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a << b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The value to shift.
 * @param right The shift amount.
 * @returns The created {@link BinaryExpression}.
 */
export const createLeftShift = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.LessThanLessThanToken, right);
