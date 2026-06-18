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
 * bar = "x";
 * ```
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
