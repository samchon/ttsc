import type { Expression, PrefixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { make } from "../internal/make";

/**
 * Create a {@link PrefixUnaryExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operator The operator token.
 * @param operand The operand.
 * @returns The created {@link PrefixUnaryExpression}.
 */
export const createPrefixUnaryExpression = (
  operator: SyntaxKind,
  operand: Expression,
): PrefixUnaryExpression =>
  make("PrefixUnaryExpression", { operator, operand });
