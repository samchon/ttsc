import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `,` operator: the comma operator,
 * which evaluates both operands and yields the right one.
 *
 * Shorthand for {@link createBinaryExpression} with the `CommaToken` operator.
 * The printer treats the comma like any other binary operator and surrounds it
 * with a single space on each side, so the output has a space before the
 * comma.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * (a, b);
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createComma = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.CommaToken, right);
