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
 * @evidence contracts/common.md#principled-implementation The private kind retains the supplied identifier and description, defaulting only an absent name to private; the result documents visibility without enforcing access.
 * @evidence contracts/common.md#clear-and-simple-design The adapter exposes name defaulting directly and stores no duplicate private modifier or access-checking layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The private spelling is annotation syntax, not an API blacklist or a mutation of foreign declaration accessibility.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the default and optional description, with a bare-tag example and distinct paragraphs under the documentation guidance.
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
