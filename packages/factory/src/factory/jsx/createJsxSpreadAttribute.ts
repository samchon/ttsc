import type { Expression, JsxSpreadAttribute } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxSpreadAttribute}: a `{...expr}` prop that spreads an
 * object's members onto a JSX element.
 *
 * The expression evaluates to the object whose own properties become
 * attributes. It sits among ordinary {@link JsxAttribute} entries inside a
 * {@link JsxAttributes} list.
 *
 * Given the expression `props`, the printer emits:
 *
 * ```tsx
 * {...props}
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link JsxSpreadAttribute}.
 */
export const createJsxSpreadAttribute = (
  expression: Expression,
): JsxSpreadAttribute => make("JsxSpreadAttribute", { expression });
