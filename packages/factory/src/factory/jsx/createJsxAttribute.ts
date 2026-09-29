import type {
  JsxAttribute,
  JsxAttributeName,
  JsxAttributeValue,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxAttribute}: a single `name=value` prop on a JSX element.
 *
 * The name is a plain identifier or a {@link JsxNamespacedName} like
 * `xlink:href`. The initializer is the value: a string literal, or a
 * {@link JsxExpression} brace such as `{value}`. Pass `undefined` for a bare
 * boolean-style attribute, which prints the name alone with no `=value`.
 *
 * Given the name `bar` and a string-literal initializer `"x"`, the printer
 * emits:
 *
 * ```tsx
 * bar="x"
 * ```
 *
 * @evidence contracts/common.md#principled-implementation
 *   The structured name and optional value retain attribute roles; undefined
 *   means a bare attribute rather than an invented boolean literal assignment.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One attribute node covers bare, string and expression values, leaving =
 *   spelling and surrounding inter-attribute spacing to the printer.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Attribute names do not trigger hidden defaults or value replacements, and
 *   the initializer is not flattened into patched JSX source.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains namespaced names, value forms and bare attributes; the
 *   corrected example matches JSX attribute punctuation without a semicolon.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The name.
 * @param initializer The initializer, if any.
 * @returns The created {@link JsxAttribute}.
 */
export const createJsxAttribute = (
  name: JsxAttributeName,
  initializer: JsxAttributeValue | undefined,
): JsxAttribute =>
  make("JsxAttribute", {
    name,
    initializer,
  });
