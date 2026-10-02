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
 * @evidence contracts/common.md#principled-implementation
 *   The optional spread marker and expression remain distinct brace-content
 *   fields; an omitted expression intentionally represents empty JSX braces.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One node serves attribute or child embedding without a source-string
 *   parser; the caller supplies a context-valid spread/empty combination.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Expression names do not trigger substituted values or hidden conditions;
 *   the brace form is derived from explicit nodes rather than patched text.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains ordinary, empty and spread braces before its example and
 *   documents both optional inputs rather than claiming grammar validation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
