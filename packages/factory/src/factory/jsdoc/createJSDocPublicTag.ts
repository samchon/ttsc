import type { Identifier, JSDocComment, JSDocPublicTag } from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocPublicTag}: a `@public` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `public` when omitted. The
 * `comment` is the trailing description, if any.
 *
 * With the default tag name and no comment, the printer emits:
 *
 * ```ts
 * @public
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `public`.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocPublicTag}.
 */
export const createJSDocPublicTag = (
  tagName: Identifier | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocPublicTag =>
  make("JSDocPublicTag", {
    tagName: tagName ?? createIdentifier("public"),
    comment,
  });
