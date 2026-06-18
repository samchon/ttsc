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
