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
 * ++a;
 * ```
 *
 * Supply a legal update target; this builder does not validate or update it.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to increment.
 * @returns The created {@link PrefixUnaryExpression}.
 * @evidence contracts/common.md#principled-implementation PlusPlusToken in prefix position represents pre-increment with the supplied target; assignability is a caller premise.
 * @evidence contracts/common.md#clear-and-simple-design The shared prefix constructor owns shape, while this wrapper selects the increment token only.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Construction records update syntax instead of mutating a host variable or substituting a known incremented result.
 * @evidence contracts/common.md#meaningful-documentation Native prose states legal-target ownership alongside the operation and operand; example and acknowledgment block remain separated.
 */
export const createPrefixIncrement = (
  operand: Expression,
): PrefixUnaryExpression =>
  createPrefixUnaryExpression(SyntaxKind.PlusPlusToken, operand);
