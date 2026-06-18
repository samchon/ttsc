import type { Expression, PostfixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createPostfixUnaryExpression } from "./createPostfixUnaryExpression";

/**
 * Create a postfix decrement expression: `operand--`.
 *
 * Thin wrapper over {@link createPostfixUnaryExpression} with the `--` operator.
 *
 * With `operand` of `a`, the printer emits:
 *
 * ```ts
 * a--;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to decrement.
 * @returns The created {@link PostfixUnaryExpression}.
 */
export const createPostfixDecrement = (
  operand: Expression,
): PostfixUnaryExpression =>
  createPostfixUnaryExpression(operand, SyntaxKind.MinusMinusToken);
