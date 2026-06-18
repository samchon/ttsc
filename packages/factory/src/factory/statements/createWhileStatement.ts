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
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param statement The statement.
 * @returns The created {@link WhileStatement}.
 */
export const createWhileStatement = (
  expression: Expression,
  statement: Statement,
): WhileStatement => make("WhileStatement", { expression, statement });
