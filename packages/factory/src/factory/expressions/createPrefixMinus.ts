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
 * @evidence contracts/common.md#principled-implementation MinusToken in prefix position retains negation without folding the operand or conflating it with binary subtraction.
 * @evidence contracts/common.md#clear-and-simple-design One prefix-builder call reuses unary shape and leaves parenthesization and token collision handling to the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The negation operator is contract-defined rather than a hardcoded negative literal selected for expected cases.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies unary minus, shared construction and the operand, with a separate expression example and tags.
 */
export const createPrefixMinus = (operand: Expression): PrefixUnaryExpression =>
  createPrefixUnaryExpression(SyntaxKind.MinusToken, operand);
