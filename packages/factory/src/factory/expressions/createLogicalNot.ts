import type { Expression, PrefixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createPrefixUnaryExpression } from "./createPrefixUnaryExpression";

/**
 * Create a {@link PrefixUnaryExpression} with the `!` operator: logical NOT.
 *
 * Shorthand for {@link createPrefixUnaryExpression} with the `ExclamationToken`
 * operator. The printer writes the operator directly before the operand with no
 * separating space.
 *
 * Given operand `a`, the printer emits:
 *
 * ```ts
 * !a;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to negate.
 * @returns The created {@link PrefixUnaryExpression}.
 */
export const createLogicalNot = (operand: Expression): PrefixUnaryExpression =>
  createPrefixUnaryExpression(SyntaxKind.ExclamationToken, operand);
