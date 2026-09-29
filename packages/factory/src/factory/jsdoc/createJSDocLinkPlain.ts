import type { EntityName, JSDocLinkPlain, JSDocMemberName } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocLinkPlain}: an inline `{@linkplain ...}` reference.
 *
 * The `name` is the linked target, if any, and `text` is the trailing label,
 * rendered as plain text by documentation tooling. The printer appends the text
 * to the name verbatim, with no separator inserted between them, so any space
 * you want before the label must be part of `text`.
 *
 * With a `Foo` name and a ` the foo` text (note the leading space), the printer
 * emits:
 *
 * ```ts
 * {@linkplain Foo the foo}
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The linkplain kind records plain-style annotation spelling while retaining an optional target and raw suffix; no target resolution or styling is performed by construction.
 * @evidence contracts/common.md#clear-and-simple-design Two assignments retain the name/text separation, and the kind replaces the need for another style selector.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Plain styling uses the public link form instead of a special label rewrite or mutation of a foreign documentation renderer.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains plain styling and required label spacing with an example; paragraph and tag separation follows the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The linked name, if any.
 * @param text The trailing link text.
 * @returns The created {@link JSDocLinkPlain}.
 */
export const createJSDocLinkPlain = (
  name: EntityName | JSDocMemberName | undefined,
  text: string,
): JSDocLinkPlain =>
  make("JSDocLinkPlain", {
    name,
    text,
  });
