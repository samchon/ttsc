import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a strict inequality expression: `left !== right`.
 *
 * Thin wrapper over {@link createBinaryExpression} with the `!==` operator.
 *
 * With `left` of `a` and `right` of `b`, the printer emits:
 *
 * ```ts
 * a !== b
 * ```
 *
 * @evidence contracts/common.md#principled-implementation ExclamationEqualsEqualsToken records strict inequality without coercing operands or computing a boolean during construction.
 * @evidence contracts/common.md#clear-and-simple-design Operator selection delegates to the shared binary builder rather than wrapping equality in another expression.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Strict inequality is retained as supplied syntax instead of an expected-result branch for known operands.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies strict inequality, the shared builder and operand roles with a separate example and acknowledgment block.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createStrictInequality = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.ExclamationEqualsEqualsToken, right);
