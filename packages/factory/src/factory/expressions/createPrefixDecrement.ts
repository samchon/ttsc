import type { Expression, PrefixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createPrefixUnaryExpression } from "./createPrefixUnaryExpression";

/**
 * Create a prefix decrement expression: `--operand`.
 *
 * Thin wrapper over {@link createPrefixUnaryExpression} with the `--` operator.
 *
 * With `operand` of `a`, the printer emits:
 *
 * ```ts
 * --a;
 * ```
 *
 * Supply a legal update target; this builder does not validate or update it.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to decrement.
 * @returns The created {@link PrefixUnaryExpression}.
 * @evidence contracts/common.md#principled-implementation MinusMinusToken before the operand records pre-decrement; the caller establishes that the operand is a legal update target.
 * @evidence contracts/common.md#clear-and-simple-design Decrement selection is one delegation to the common prefix node constructor.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The builder records a decrement rather than changing a foreign value or supplying a predicted update result.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies target restrictions and prefix behavior, with an expression example and separate tag block under documentation guidance.
 */
export const createPrefixDecrement = (
  operand: Expression,
): PrefixUnaryExpression =>
  createPrefixUnaryExpression(SyntaxKind.MinusMinusToken, operand);
