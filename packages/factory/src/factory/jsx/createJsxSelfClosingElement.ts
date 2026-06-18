import type {
  JsxAttributes,
  JsxSelfClosingElement,
  JsxTagName,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxSelfClosingElement}: a `<Tag />` element with no children.
 *
 * The tag name accepts a plain identifier, a property-access chain like
 * `Foo.Bar`, or a {@link JsxNamespacedName}. Optional `typeArguments` render as
 * a generic argument list right after the tag name. The attributes carry the
 * element's props; pass an empty {@link JsxAttributes} for none.
 *
 * Given the tag name `Foo`, no type arguments, and attributes holding a single
 * `bar="x"`, the printer emits:
 *
 * ```tsx
 * <Foo bar="x" />
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name.
 * @param typeArguments The generic type arguments, if any.
 * @param attributes The attributes.
 * @returns The created {@link JsxSelfClosingElement}.
 */
export const createJsxSelfClosingElement = (
  tagName: JsxTagName,
  typeArguments: readonly TypeNode[] | undefined,
  attributes: JsxAttributes,
): JsxSelfClosingElement =>
  make("JsxSelfClosingElement", {
    tagName,
    typeArguments,
    attributes,
  });
