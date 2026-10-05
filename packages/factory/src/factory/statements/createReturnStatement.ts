import type { Expression, ReturnStatement } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link ReturnStatement}: a `return ...;` statement.
 *
 * The optional `expression` is the value handed back to the caller. Omit it for
 * a bare `return;` that yields `undefined`.
 *
 * When leading synthetic comments would put a line break between `return` and
 * the expression's first token, the printer groups the expression in
 * parentheses so automatic semicolon insertion does not change the returned
 * value.
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
 * @evidence contracts/common.md#principled-implementation
 *   Optional expression distinguishes bare return from returning a value;
 *   keeping the expression tree leaves grammar-safe parenthesization to printing.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The node owns return context only; it does not evaluate the returned value.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Omission produces real bare-return syntax rather than a fabricated value.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains bare-return undefined semantics and value return with two
 *   separate examples before the acknowledgment paragraphs.
 */
export const createReturnStatement = (
  expression?: Expression,
): ReturnStatement => make("ReturnStatement", { expression });
