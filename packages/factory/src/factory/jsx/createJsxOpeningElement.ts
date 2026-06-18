import type {
  JsxAttributes,
  JsxOpeningElement,
  JsxTagName,
  TypeNode,
} from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxOpeningElement}: the `<Tag>` that opens a paired
 * {@link JsxElement}.
 *
 * This is the leading half of a `<Tag>...</Tag>` pair; it carries the tag name,
 * optional generic `typeArguments`, and the attributes, but no children and no
 * trailing slash. Pair it with a matching {@link JsxClosingElement} through
 * {@link createJsxElement}.
 *
 * Given the tag name `Foo`, no type arguments, and attributes holding a single
 * `bar="x"`, the printer emits:
 *
 * ```tsx
 * <Foo bar="x">
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name.
 * @param typeArguments The generic type arguments, if any.
 * @param attributes The attributes.
 * @returns The created {@link JsxOpeningElement}.
 */
export const createJsxOpeningElement = (
  tagName: JsxTagName,
  typeArguments: readonly TypeNode[] | undefined,
  attributes: JsxAttributes,
): JsxOpeningElement =>
  make("JsxOpeningElement", {
    tagName,
    typeArguments,
    attributes,
  });
