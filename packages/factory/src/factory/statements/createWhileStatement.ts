import type { Expression, Statement, WhileStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link WhileStatement}: a `while (...) ...` loop.
 *
 * The `expression` is the condition tested before each pass and `statement` is
 * the loop body. The body runs zero or more times, only while the condition
 * holds.
 *
 * With an `expression` of `cond` and a `statement` block calling `a()`, the
 * result is:
 *
 * ```ts
 * while (cond) {
 *   a();
 * }
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   Condition and body retain while's pre-test order; zero-iteration behavior
 *   follows emitted grammar rather than an eagerly evaluated condition here.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The node models two subtrees without a separate iteration abstraction.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Caller conditions are not replaced by fixed iteration counts or retries.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs state pre-pass testing and zero-or-more execution, with
 *   a loop example separate from acknowledgment tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param statement The statement.
 * @returns The created {@link WhileStatement}.
 */
export const createWhileStatement = (
  expression: Expression,
  statement: Statement,
): WhileStatement => make("WhileStatement", { expression, statement });
