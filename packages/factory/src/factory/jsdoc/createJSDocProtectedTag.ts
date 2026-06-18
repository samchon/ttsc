import type { Identifier, JSDocComment, JSDocProtectedTag } from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocProtectedTag}: a `@protected` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `protected` when omitted. The
 * `comment` is the trailing description, if any.
 *
 * With the default tag name and no comment, the printer emits:
 *
 * ```ts
 * @protected
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `protected`.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocProtectedTag}.
 */
export const createJSDocProtectedTag = (
  tagName: Identifier | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocProtectedTag =>
  make("JSDocProtectedTag", {
    tagName: tagName ?? createIdentifier("protected"),
    comment,
  });
