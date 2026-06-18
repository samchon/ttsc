import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `**` operator: exponentiation.
 *
 * Shorthand for {@link createBinaryExpression} with the `AsteriskAsteriskToken`
 * operator. The printer surrounds the operator with a single space on each
 * side.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a ** b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The base operand.
 * @param right The exponent operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createExponent = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.AsteriskAsteriskToken, right);
