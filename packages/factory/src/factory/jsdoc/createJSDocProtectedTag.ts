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
 * @evidence contracts/common.md#principled-implementation An explicit identifier or protected default and optional comment record visibility annotation syntax without checking inheritance or restricting access.
 * @evidence contracts/common.md#clear-and-simple-design The two payload assignments need no class-hierarchy model or separate modifier-building step.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The protected default is a supported marker rather than an inferred hierarchy result or special permission for known members.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes the name default and comment omission with an output example; paragraph and native-tag separation follows the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
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
