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
 * @evidence contracts/common.md#principled-implementation
 *   The expression remains the source of the spread at its explicit list
 *   position; syntax construction does not evaluate or enumerate its properties.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A one-expression node models {...expr} independently of ordinary props,
 *   while the attributes parent owns override-sensitive ordering.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No selected prop names are expanded or removed from the expression, and
 *   expected JSX output does not cause a synthetic props object to be inserted.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native description locates the spread among ordinary attributes and
 *   uses a direct brace example, with expression and return type documented.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param expression The expression.
 * @returns The created {@link JsxSpreadAttribute}.
 */
export const createJsxSpreadAttribute = (
  expression: Expression,
): JsxSpreadAttribute => make("JsxSpreadAttribute", { expression });
