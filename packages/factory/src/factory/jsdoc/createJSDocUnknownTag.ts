import type { Identifier, JSDocComment, JSDocUnknownTag } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocUnknownTag}: a JSDoc tag whose name is not one of the
 * recognized tags.
 *
 * The `tagName` is the identifier after the `@`, and `comment` is the trailing
 * text. This is the fallback node for any custom or unrecognized tag.
 *
 * With a tag name of `custom` and a `hello` comment, the printer emits:
 *
 * ```ts
 * @custom hello
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocUnknownTag}.
 */
export const createJSDocUnknownTag = (
  tagName: Identifier,
  comment?: string | readonly JSDocComment[],
): JSDocUnknownTag =>
  make("JSDocUnknownTag", {
    tagName,
    comment,
  });
