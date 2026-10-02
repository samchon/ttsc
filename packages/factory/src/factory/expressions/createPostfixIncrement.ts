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
 * a++
 * ```
 *
 * Supply a legal update target; this builder does not validate or update it.
 *
 * @evidence contracts/common.md#principled-implementation PlusPlusToken after the retained operand represents postfix increment, preserving its distinction from the prefix form; target validity is caller-owned.
 * @evidence contracts/common.md#clear-and-simple-design One postfix-builder call keeps operand/operator structure shared and fixes only the increment operation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Neither target mutation nor a known previous value is performed or fabricated while constructing the outline.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states postfix increment and legal-target responsibility; its expression example and acknowledgment tags are separate.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to increment.
 * @returns The created {@link PostfixUnaryExpression}.
 */
export const createPostfixIncrement = (
  operand: Expression,
): PostfixUnaryExpression =>
  createPostfixUnaryExpression(operand, SyntaxKind.PlusPlusToken);
