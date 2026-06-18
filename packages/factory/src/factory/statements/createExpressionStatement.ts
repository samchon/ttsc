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
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ExpressionStatement}.
 */
export const createExpressionStatement = (
  expression: Expression,
): ExpressionStatement => make("ExpressionStatement", { expression });
