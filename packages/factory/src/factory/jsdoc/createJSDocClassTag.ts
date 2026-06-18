import type { Identifier, JSDocClassTag, JSDocComment } from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocClassTag}: a `@class` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `class` when omitted. The
 * `comment` is the trailing description, if any.
 *
 * With the default tag name and no comment, the printer emits:
 *
 * ```ts
 * @class
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `class`.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocClassTag}.
 */
export const createJSDocClassTag = (
  tagName: Identifier | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocClassTag =>
  make("JSDocClassTag", {
    tagName: tagName ?? createIdentifier("class"),
    comment,
  });
