import type { Expression, PostfixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link PostfixUnaryExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand.
 * @param operator The operator token.
 * @returns The created {@link PostfixUnaryExpression}.
 */
export const createPostfixUnaryExpression = (
  operand: Expression,
  operator: SyntaxKind,
): PostfixUnaryExpression =>
  make("PostfixUnaryExpression", { operand, operator });
