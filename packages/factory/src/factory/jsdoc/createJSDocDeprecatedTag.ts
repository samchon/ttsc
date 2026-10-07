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
 * @evidence contracts/common.md#principled-implementation The supplied name or deprecated default and optional description record a deprecation annotation; this construction does not change API availability or enforce migration.
 * @evidence contracts/common.md#clear-and-simple-design A single nullish name default leaves deprecation guidance in comment data, avoiding unused version or replacement-resolution state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The default is conventional tag syntax and the migration text is supplied, rather than API-name exceptions or injected failure behavior.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the default name and deprecation description with a replacement example; separate paragraphs and native tags follow the documentation guidance.
 */
export const createJSDocDeprecatedTag = (
  tagName: Identifier | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocDeprecatedTag =>
  make("JSDocDeprecatedTag", {
    tagName: tagName ?? createIdentifier("deprecated"),
    comment,
  });
