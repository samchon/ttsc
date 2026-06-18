import type { JsxClosingElement, JsxTagName } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JsxClosingElement}: the `</Tag>` that closes a paired
 * {@link JsxElement}.
 *
 * This is the trailing half of a `<Tag>...</Tag>` pair. The tag name must match
 * the one on the corresponding {@link JsxOpeningElement}; the factory does not
 * enforce that, so the caller is responsible for passing the same name.
 *
 * Given the tag name `Foo`, the printer emits:
 *
 * ```tsx
 * </Foo>
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name.
 * @returns The created {@link JsxClosingElement}.
 */
export const createJsxClosingElement = (
  tagName: JsxTagName,
): JsxClosingElement => make("JsxClosingElement", { tagName });
