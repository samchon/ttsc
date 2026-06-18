import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `=` operator: a simple assignment.
 *
 * Shorthand for {@link createBinaryExpression} with the `EqualsToken` operator.
 * The left operand is the assignment target and the right operand is the value.
 * The printer surrounds the operator with a single space on each side.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a = b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The assignment target.
 * @param right The value to assign.
 * @returns The created {@link BinaryExpression}.
 */
export const createAssignment = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.EqualsToken, right);
