import type { DoStatement, Expression, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link DoStatement}: a `do ... while (...)` loop.
 *
 * The `statement` is the loop body and `expression` is the condition tested
 * after each pass, so the body always runs at least once. Note the argument
 * order: the body comes before the condition, matching the source layout.
 *
 * With a `statement` block calling `a()` and an `expression` of `cond`, the
 * result is:
 *
 * ```ts
 * do {
 *   a();
 * } while (cond);
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The body and condition occupy do-while's distinct slots, preserving the
 *   after-body condition position rather than lowering it to a while loop.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Two supplied subtrees model the loop; execution/iteration state is not owned here.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No first-iteration exception compensates for choosing another loop form.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains body-first argument order and at-least-once execution, with
 *   a do-while example separated from the acknowledgment block.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param statement The statement.
 * @param expression The expression.
 * @returns The created {@link DoStatement}.
 */
export const createDoStatement = (
  statement: Statement,
  expression: Expression,
): DoStatement => make("DoStatement", { statement, expression });
