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
 * -1
 * ```
 *
 * @evidence contracts/common.md#principled-implementation MinusToken in prefix position retains negation without folding the operand or conflating it with binary subtraction.
 * @evidence contracts/common.md#clear-and-simple-design One prefix-builder call reuses unary shape and leaves parenthesization and token collision handling to the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The negation operator is contract-defined rather than a hardcoded negative literal selected for expected cases.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies unary minus, shared construction and the operand, with a separate expression example and tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to negate.
 * @returns The created {@link PrefixUnaryExpression}.
 */
export const createPrefixMinus = (operand: Expression): PrefixUnaryExpression =>
  createPrefixUnaryExpression(SyntaxKind.MinusToken, operand);
