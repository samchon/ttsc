import type { AwaitExpression, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link AwaitExpression}: an `await` of an operand.
 *
 * The printer writes the `await` keyword followed by a single space and the
 * operand expression.
 *
 * Given operand `promise`, the printer emits:
 *
 * ```ts
 * await promise
 * ```
 *
 * Callers establish that await is allowed in the enclosing function or module.
 * Constructing the outline neither waits nor checks that context.
 *
 * @evidence contracts/common.md#principled-implementation The await kind and unchanged operand record awaiting syntax; enclosing-context legality remains a caller premise and no scheduling occurs during construction.
 * @evidence contracts/common.md#clear-and-simple-design One operand feeds make without promise state, scheduling helpers or duplicate keyword tokens.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The builder does not monkey-patch a promise or substitute a known fulfilled value for its operand.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains emission and enclosing-context ownership, with parameter, example and tag separation following documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The awaited expression.
 * @returns The created {@link AwaitExpression}.
 */
export const createAwaitExpression = (
  expression: Expression,
): AwaitExpression => make("AwaitExpression", { expression });
