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
 */
export const createDoStatement = (
  statement: Statement,
  expression: Expression,
): DoStatement => make("DoStatement", { statement, expression });
