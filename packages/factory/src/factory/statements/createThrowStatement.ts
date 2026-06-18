import type { Expression, ThrowStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ThrowStatement}: a `throw ...;` statement.
 *
 * The `expression` is the value raised, commonly a freshly constructed error.
 * Unlike `return`, the expression is required.
 *
 * With an `expression` of `new Error("oops")`, the result is:
 *
 * ```ts
 * throw new Error("oops");
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ThrowStatement}.
 */
export const createThrowStatement = (expression: Expression): ThrowStatement =>
  make("ThrowStatement", { expression });
