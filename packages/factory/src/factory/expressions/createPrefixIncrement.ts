import type { Expression, PrefixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createPrefixUnaryExpression } from "./createPrefixUnaryExpression";

/**
 * Create a prefix increment expression: `++operand`.
 *
 * Thin wrapper over {@link createPrefixUnaryExpression} with the `++` operator.
 *
 * With `operand` of `a`, the printer emits:
 *
 * ```ts
 * ++a
 * ```
 *
 * Supply a legal update target; this builder does not validate or update it.
 *
 * @evidence contracts/common.md#principled-implementation PlusPlusToken in prefix position represents pre-increment with the supplied target; assignability is a caller premise.
 * @evidence contracts/common.md#clear-and-simple-design The shared prefix constructor owns shape, while this wrapper selects the increment token only.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Construction records update syntax instead of mutating a host variable or substituting a known incremented result.
 * @evidence contracts/common.md#meaningful-documentation Native prose states legal-target ownership alongside the operation and operand; example and acknowledgment block remain separated.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to increment.
 * @returns The created {@link PrefixUnaryExpression}.
 */
export const createPrefixIncrement = (
  operand: Expression,
): PrefixUnaryExpression =>
  createPrefixUnaryExpression(SyntaxKind.PlusPlusToken, operand);
