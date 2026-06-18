import type { Expression, ReturnStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ReturnStatement}: a `return ...;` statement.
 *
 * The optional `expression` is the value handed back to the caller. Omit it for
 * a bare `return;` that yields `undefined`.
 *
 * With no expression the result is:
 *
 * ```ts
 * return;
 * ```
 *
 * With an `expression` of `value` the result is:
 *
 * ```ts
 * return value;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link ReturnStatement}.
 */
export const createReturnStatement = (
  expression?: Expression,
): ReturnStatement => make("ReturnStatement", { expression });
