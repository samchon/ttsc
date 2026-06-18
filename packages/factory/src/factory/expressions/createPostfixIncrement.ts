import type { Expression, PostfixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createPostfixUnaryExpression } from "./createPostfixUnaryExpression";

/**
 * Create a postfix increment expression: `operand++`.
 *
 * Thin wrapper over {@link createPostfixUnaryExpression} with the `++` operator.
 *
 * With `operand` of `a`, the printer emits:
 *
 * ```ts
 * a++;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to increment.
 * @returns The created {@link PostfixUnaryExpression}.
 */
export const createPostfixIncrement = (
  operand: Expression,
): PostfixUnaryExpression =>
  createPostfixUnaryExpression(operand, SyntaxKind.PlusPlusToken);
