import type { Identifier, JSDocComment, JSDocOverrideTag } from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocOverrideTag}: an `@override` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `override` when omitted. The
 * `comment` is the trailing description, if any.
 *
 * With the default tag name and no comment, the printer emits:
 *
 * ```ts
 * @override
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `override`.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocOverrideTag}.
 */
export const createJSDocOverrideTag = (
  tagName: Identifier | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocOverrideTag =>
  make("JSDocOverrideTag", {
    tagName: tagName ?? createIdentifier("override"),
    comment,
  });
