import type { EntityName, JSDocLink, JSDocMemberName } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocLink}: an inline `{@link ...}` reference.
 *
 * The `name` is the linked target, if any, and `text` is the trailing label.
 * The printer appends the text to the name verbatim, with no separator inserted
 * between them, so any space you want before the label must be part of `text`.
 * When `name` is omitted, only the text is printed.
 *
 * With a `Foo` name and a ` the foo` text (note the leading space), the printer
 * emits:
 *
 * ```ts
 * {@link Foo the foo}
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param name The linked name, if any.
 * @param text The trailing link text.
 * @returns The created {@link JSDocLink}.
 */
export const createJSDocLink = (
  name: EntityName | JSDocMemberName | undefined,
  text: string,
): JSDocLink =>
  make("JSDocLink", {
    name,
    text,
  });
