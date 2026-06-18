import type { Expression, Statement, WithStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link WithStatement}: a `with (...) ...` statement.
 *
 * The `expression` supplies the object whose properties join the scope of
 * `statement`, the body. `with` is disallowed in strict mode and in ES modules,
 * so this exists mainly for completeness and faithful round-tripping.
 *
 * With an `expression` of `obj` and a `statement` block calling `a()`, the
 * result is:
 *
 * ```ts
 * with (obj) {
 *   a();
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param statement The statement.
 * @returns The created {@link WithStatement}.
 */
export const createWithStatement = (
  expression: Expression,
  statement: Statement,
): WithStatement => make("WithStatement", { expression, statement });
