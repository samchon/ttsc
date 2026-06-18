import type { Identifier, JSDocAuthorTag, JSDocComment } from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocAuthorTag}: an `@author` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `author` when omitted. The
 * `comment` is the trailing text naming the author.
 *
 * With the default tag name and a `Jeongho Nam` comment, the printer emits:
 *
 * ```ts
 * @author Jeongho Nam
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `author`.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocAuthorTag}.
 */
export const createJSDocAuthorTag = (
  tagName: Identifier | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocAuthorTag =>
  make("JSDocAuthorTag", {
    tagName: tagName ?? createIdentifier("author"),
    comment,
  });
