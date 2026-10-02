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
 * --a
 * ```
 *
 * Supply a legal update target; this builder does not validate or update it.
 *
 * @evidence contracts/common.md#principled-implementation MinusMinusToken before the operand records pre-decrement; the caller establishes that the operand is a legal update target.
 * @evidence contracts/common.md#clear-and-simple-design Decrement selection is one delegation to the common prefix node constructor.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The builder records a decrement rather than changing a foreign value or supplying a predicted update result.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies target restrictions and prefix behavior, with an expression example and separate tag block under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to decrement.
 * @returns The created {@link PrefixUnaryExpression}.
 */
export const createPrefixDecrement = (
  operand: Expression,
): PrefixUnaryExpression =>
  createPrefixUnaryExpression(SyntaxKind.MinusMinusToken, operand);
