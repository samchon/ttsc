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
 * @evidence contracts/common.md#principled-implementation The adapter preserves a supplied tag identifier and author description, creating the documented author spelling only when the identifier is absent; it performs no identity resolution.
 * @evidence contracts/common.md#clear-and-simple-design One nullish default and direct comment assignment expose the entire construction without an author registry or another policy layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The author spelling is a supported default, while actual author text is caller data rather than a fixed identity or special consumer case.
 * @evidence contracts/common.md#meaningful-documentation Native prose and parameter comments explain the default name and author-description role with an example; paragraph and native-tag separation follows the documentation guidance.
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
