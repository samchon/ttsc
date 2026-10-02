import type { Expression, ExpressionStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ExpressionStatement}: an expression used as a statement.
 *
 * The `expression` is evaluated for its effect and the printer terminates it
 * with a semicolon. This is how a call, assignment, or similar expression
 * becomes a standalone statement.
 *
 * With `expression` of a `doThing(a)` call, the result is:
 *
 * ```ts
 * doThing(a);
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Wrapping an Expression in ExpressionStatement marks statement context so
 *   the printer can supply termination and any grammar-required parentheses.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Expression structure is retained; this wrapper only changes its context.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The builder does not evaluate or substitute the expression's effects.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains effect-oriented statement use and semicolon ownership,
 *   with a call example separate from acknowledgment paragraphs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ExpressionStatement}.
 */
export const createExpressionStatement = (
  expression: Expression,
): ExpressionStatement => make("ExpressionStatement", { expression });
