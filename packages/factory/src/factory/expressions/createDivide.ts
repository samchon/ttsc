import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `/` operator: division.
 *
 * Shorthand for {@link createBinaryExpression} with the `SlashToken` operator.
 * Flat output surrounds the operator with spaces; width can break after it.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a / b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 * @evidence contracts/common.md#principled-implementation SlashToken and ordered operands retain division syntax without assuming integer division or evaluating exceptional numeric inputs.
 * @evidence contracts/common.md#clear-and-simple-design One delegation selects division while shared binary construction and printer precedence stay with their owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The slash is the requested operation, not a divisor or result hardcoded for known cases.
 * @evidence contracts/common.md#meaningful-documentation JSDoc describes division, operand order and its expression form; examples and parameter tags remain separated under documentation guidance.
 */
export const createDivide = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.SlashToken, right);
