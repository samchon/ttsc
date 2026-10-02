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
 * @evidence contracts/common.md#principled-implementation The class tag kind, preserved identifier or documented class default and optional description construct a documentation marker without creating a class declaration.
 * @evidence contracts/common.md#clear-and-simple-design A direct name default and comment assignment retain only the marker's payload, without constructor or member state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The class spelling is the public default rather than a known-consumer class name, and no foreign declaration is modified.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the default and optional description and shows bare-tag output; separate paragraphs and parameter descriptions follow the documentation guidance.
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
