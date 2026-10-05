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
 * @evidence contracts/common.md#principled-implementation Preserving the identifier or selecting the override default constructs the annotation alongside optional prose, without proving a base-member relationship.
 * @evidence contracts/common.md#clear-and-simple-design The constructor stores only the marker payload rather than a duplicate hierarchy or method-resolution mechanism.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The override default records syntax and does not replace any method or guess a known base declaration.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the default and comment behavior with a bare-tag example; distinct paragraphs and native tags follow the documentation guidance.
 */
export const createJSDocOverrideTag = (
  tagName: Identifier | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocOverrideTag =>
  make("JSDocOverrideTag", {
    tagName: tagName ?? createIdentifier("override"),
    comment,
  });
