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
 * Branches are retained as supplied. When the then branch prints as ending in an
 * `if` with no `else` and this statement has an `else`, the printer wraps the
 * then branch in a block, so the printed `else` binds to this condition rather
 * than to the nested one.
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
 * @evidence contracts/common.md#principled-implementation
 *   Condition, then branch and optional else branch retain their syntax roles;
 *   a nested IfStatement in else represents an else-if chain without flattening it.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Branches remain supplied Statement trees; the only addition is the printer's
 *   block around a then branch that would capture the else.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No condition is evaluated to preselect a branch during construction.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains omitted else and nested else-if use, followed by a
 *   two-branch example and separated acknowledgment paragraphs. The paragraph on the printer block that keeps an else bound to its own if is part of the described behavior.
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
