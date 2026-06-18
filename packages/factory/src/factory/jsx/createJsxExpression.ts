import type { Expression, JsxExpression, Token } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxExpression}: a `{...}` brace embedding a JavaScript
 * expression in JSX.
 *
 * This is how a dynamic value is dropped into a child position or an attribute
 * value. Pass the `expression` to render inside the braces; pass `undefined`
 * for an empty `{}`. The optional `dotDotDotToken` (the `...` token) turns it
 * into a spread child, prefixing the expression with `...` inside the braces.
 *
 * Given no spread token and the expression `value`, the printer emits:
 *
 * ```tsx
 * {value}
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param dotDotDotToken The `...` token, if a spread.
 * @param expression The expression, if any.
 * @returns The created {@link JsxExpression}.
 */
export const createJsxExpression = (
  dotDotDotToken: Token | undefined,
  expression: Expression | undefined,
): JsxExpression =>
  make("JsxExpression", {
    dotDotDotToken,
    expression,
  });
