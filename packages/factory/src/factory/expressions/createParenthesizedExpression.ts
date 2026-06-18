import type { Expression, ParenthesizedExpression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ParenthesizedExpression}: an explicit `( ... )` grouping
 * around `expression`.
 *
 * This is an explicit grouping node that is always present in the tree; the
 * printer emits the parentheses unconditionally rather than inferring them from
 * precedence.
 *
 * With `expression` of `a % b`, the printer emits:
 *
 * ```ts
 * a % b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The inner expression to wrap in parentheses.
 * @returns The created {@link ParenthesizedExpression}.
 */
export const createParenthesizedExpression = (
  expression: Expression,
): ParenthesizedExpression => make("ParenthesizedExpression", { expression });
