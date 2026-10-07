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
 * @evidence contracts/common.md#principled-implementation
 *   The closing tag retains its structured name, with paired-name agreement
 *   explicitly left to the caller instead of assuming a matching opening exists.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   A one-name closing node does not carry children or duplicate opening
 *   attributes; the paired element owns assembly of both boundaries.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No mismatched name is silently replaced by a remembered opening tag and
 *   no raw closing source is patched for selected components.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc states the matching-tag obligation and shows the closing delimiter
 *   alone, with its name input and return type documented.
 */
export const createJsxClosingElement = (
  tagName: JsxTagName,
): JsxClosingElement => make("JsxClosingElement", { tagName });
