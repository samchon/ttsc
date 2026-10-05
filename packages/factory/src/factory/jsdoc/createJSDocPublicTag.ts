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
 * @evidence contracts/common.md#principled-implementation The preserved identifier or public default and optional prose construct a documentation visibility marker, without inserting a TypeScript access modifier.
 * @evidence contracts/common.md#clear-and-simple-design One default expression and one comment field are sufficient; access-control state remains with the actual declaration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The public default identifies supported annotation syntax rather than changing exports for a known consumer or patching foreign access checks.
 * @evidence contracts/common.md#meaningful-documentation Native prose and parameters describe the name default and omitted-description form with a bare-tag example; separate paragraphs follow the documentation guidance.
 */
export const createJSDocPublicTag = (
  tagName: Identifier | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocPublicTag =>
  make("JSDocPublicTag", {
    tagName: tagName ?? createIdentifier("public"),
    comment,
  });
