import type { Identifier, JSDocComment, JSDocDeprecatedTag } from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocDeprecatedTag}: a `@deprecated` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `deprecated` when omitted. The
 * `comment` is the trailing text explaining the deprecation.
 *
 * With the default tag name and a `use foo` comment, the printer emits:
 *
 * ```ts
 * @deprecated use foo
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `deprecated`.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocDeprecatedTag}.
 */
export const createJSDocDeprecatedTag = (
  tagName: Identifier | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocDeprecatedTag =>
  make("JSDocDeprecatedTag", {
    tagName: tagName ?? createIdentifier("deprecated"),
    comment,
  });
