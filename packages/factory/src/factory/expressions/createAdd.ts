import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `+` operator: addition or string
 * concatenation.
 *
 * Shorthand for {@link createBinaryExpression} with the `PlusToken` operator.
 * The printer surrounds the operator with a single space on each side.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a + b;
 * ```
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
