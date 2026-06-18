import type { Identifier, JSDocComment, JSDocPrivateTag } from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocPrivateTag}: a `@private` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `private` when omitted. The
 * `comment` is the trailing description, if any.
 *
 * With the default tag name and no comment, the printer emits:
 *
 * ```ts
 * @private
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `private`.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocPrivateTag}.
 */
export const createJSDocPrivateTag = (
  tagName: Identifier | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocPrivateTag =>
  make("JSDocPrivateTag", {
    tagName: tagName ?? createIdentifier("private"),
    comment,
  });
