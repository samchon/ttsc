import type { Expression, PrefixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createPrefixUnaryExpression } from "./createPrefixUnaryExpression";

/**
 * Convenience wrapper that builds the corresponding expression node.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand.
 * @returns The created expression.
 */
export const createPrefixPlus = (operand: Expression): PrefixUnaryExpression =>
  createPrefixUnaryExpression(SyntaxKind.PlusToken, operand);
