import type { ArrayLiteralExpression, Expression } from "../../ast";
import { make } from "../internal/make";

/**
 * Create an {@link ArrayLiteralExpression}: an `[...]` array literal.
 *
 * The elements may include {@link SpreadElement} and omitted holes. When
 * `multiLine` is `false` (the default) the printer keeps the array on one line
 * with comma-and-space separators. When `multiLine` is `true` it places each
 * element on its own indented line and appends a trailing comma.
 *
 * Given elements `1`, `2`, `3` on a single line, the printer emits:
 *
 * ```ts
 * [1, 2, 3];
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param elements The element expressions.
 * @param multiLine When `true`, print one entry per line.
 * @returns The created {@link ArrayLiteralExpression}.
 */
export const createArrayLiteralExpression = (
  elements: readonly Expression[] = [],
  multiLine?: boolean,
): ArrayLiteralExpression =>
  make("ArrayLiteralExpression", { elements, multiLine });
