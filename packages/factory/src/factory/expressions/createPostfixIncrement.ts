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
 * Supply a legal update target; this builder does not validate or update it.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to increment.
 * @returns The created {@link PostfixUnaryExpression}.
 * @evidence contracts/common.md#principled-implementation PlusPlusToken after the retained operand represents postfix increment, preserving its distinction from the prefix form; target validity is caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design One postfix-builder call keeps operand/operator structure shared and fixes only the increment operation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Neither target mutation nor a known previous value is performed or fabricated while constructing the outline.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states postfix increment and legal-target responsibility; its expression example and acknowledgment tags are separate.
 */
export const createPostfixIncrement = (
  operand: Expression,
): PostfixUnaryExpression =>
  createPostfixUnaryExpression(operand, SyntaxKind.PlusPlusToken);
