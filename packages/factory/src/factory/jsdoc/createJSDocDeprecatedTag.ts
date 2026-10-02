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
 * @evidence contracts/common.md#principled-implementation The supplied name or deprecated default and optional description record a deprecation annotation; this construction does not change API availability or enforce migration.
 * @evidence contracts/common.md#clear-and-simple-design A single nullish name default leaves deprecation guidance in comment data, avoiding unused version or replacement-resolution state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The default is conventional tag syntax and the migration text is supplied, rather than API-name exceptions or injected failure behavior.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the default name and deprecation description with a replacement example; separate paragraphs and native tags follow the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
