import type { Expression, PrefixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createPrefixUnaryExpression } from "./createPrefixUnaryExpression";

/**
 * Create a unary minus expression: `-operand`.
 *
 * Thin wrapper over {@link createPrefixUnaryExpression} with the `-` operator.
 *
 * With `operand` of `1`, the printer emits:
 *
 * ```ts
 * -1;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to negate.
 * @returns The created {@link PrefixUnaryExpression}.
 */
export const createPrefixMinus = (operand: Expression): PrefixUnaryExpression =>
  createPrefixUnaryExpression(SyntaxKind.MinusToken, operand);
