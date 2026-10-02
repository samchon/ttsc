import type { Expression, ParenthesizedExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ParenthesizedExpression}: an explicit `( ... )` grouping
 * around `expression`.
 *
 * This is an explicit grouping node that is always present in the tree; the
 * printer emits the parentheses unconditionally rather than inferring them from
 * precedence.
 *
 * With `expression` of `a % b`, the printer emits:
 *
 * ```ts
 * (a % b)
 * ```
 *
 * @evidence contracts/common.md#principled-implementation A dedicated grouping wrapper retains explicit parentheses independently of inferred precedence and leaves the inner expression unchanged.
 * @evidence contracts/common.md#clear-and-simple-design One make call stores the operand without reproducing its operators or precedence state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Grouping is a structural node rather than a raw-text wrapper patched onto already printed output.
 * @evidence contracts/common.md#meaningful-documentation Native prose states unconditional grouping and the example includes those actual parentheses; description and tags remain separate under documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The inner expression to wrap in parentheses.
 * @returns The created {@link ParenthesizedExpression}.
 */
export const createParenthesizedExpression = (
  expression: Expression,
): ParenthesizedExpression => make("ParenthesizedExpression", { expression });
