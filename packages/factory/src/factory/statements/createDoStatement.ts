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
 * @author Jeongho Nam - https://github.com/samchon
 * @param statement The statement.
 * @param expression The expression.
 * @returns The created {@link DoStatement}.
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
 */
export const createDoStatement = (
  statement: Statement,
  expression: Expression,
): DoStatement => make("DoStatement", { statement, expression });
