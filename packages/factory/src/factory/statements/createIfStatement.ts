import type { Expression, IfStatement, Statement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link IfStatement}: an `if (...) ... else ...` statement.
 *
 * The `expression` is the condition, `thenStatement` runs when it holds, and
 * the optional `elseStatement` runs otherwise. Omit `elseStatement` for a bare
 * `if`; to build an `else if` chain, pass another `IfStatement` as
 * `elseStatement`.
 *
 * With an `expression` of `x`, a `thenStatement` block calling `a()`, and an
 * `elseStatement` block calling `b()`, the result is:
 *
 * ```ts
 * if (x) {
 *   a();
 * } else {
 *   b();
 * }
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @param thenStatement The statement run when the condition holds.
 * @param elseStatement The statement run otherwise, if any.
 * @returns The created {@link IfStatement}.
 */
export const createIfStatement = (
  expression: Expression,
  thenStatement: Statement,
  elseStatement?: Statement,
): IfStatement =>
  make("IfStatement", { expression, thenStatement, elseStatement });
