import type { Expression, PostfixUnaryExpression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createPostfixUnaryExpression } from "./createPostfixUnaryExpression";

/**
 * Create a postfix decrement expression: `operand--`.
 *
 * Thin wrapper over {@link createPostfixUnaryExpression} with the `--` operator.
 *
 * With `operand` of `a`, the printer emits:
 *
 * ```ts
 * a--
 * ```
 *
 * Supply a legal update target; this builder does not validate or update it.
 *
 * @evidence contracts/common.md#principled-implementation MinusMinusToken after the operand retains postfix decrement rather than prefix result semantics; the caller supplies a valid update target.
 * @evidence contracts/common.md#clear-and-simple-design This wrapper selects decrement through the existing postfix constructor without another update-node representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The target remains supplied syntax instead of a patched value or fixture-dependent decrement result.
 * @evidence contracts/common.md#meaningful-documentation Native prose states postfix behavior and target restrictions; expression example, parameters and acknowledgment block remain separate under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param operand The operand to decrement.
 * @returns The created {@link PostfixUnaryExpression}.
 */
export const createPostfixDecrement = (
  operand: Expression,
): PostfixUnaryExpression =>
  createPostfixUnaryExpression(operand, SyntaxKind.MinusMinusToken);
