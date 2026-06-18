import type { Expression, PrefixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createPrefixUnaryExpression } from "./createPrefixUnaryExpression";

/**
 * Create a unary plus expression: `+operand`.
 *
 * Thin wrapper over {@link createPrefixUnaryExpression} with the `+` operator.
 *
 * With `operand` of `a`, the printer emits:
 *
 * ```ts
 * +a;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand.
 * @returns The created {@link PrefixUnaryExpression}.
 */
export const createPrefixPlus = (operand: Expression): PrefixUnaryExpression =>
  createPrefixUnaryExpression(SyntaxKind.PlusToken, operand);
