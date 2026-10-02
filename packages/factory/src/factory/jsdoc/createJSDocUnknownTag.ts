import type { Identifier, JSDocComment, JSDocUnknownTag } from "../../ast";
import { make } from "../internal/make";

/**
 * Create a {@link JSDocUnknownTag}: a JSDoc tag whose name is not one of the
 * recognized tags.
 *
 * The `tagName` is the identifier after the `@`, and `comment` is the trailing
 * text. This is the fallback node for any custom or unrecognized tag.
 *
 * With a tag name of `custom` and a `hello` comment, the printer emits:
 *
 * ```ts
 * @custom hello
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Directly retaining the required identifier and optional description represents uninterpreted tag syntax without validating that the name is unknown or interpreting its semantics.
 * @evidence contracts/common.md#clear-and-simple-design One public constructor handles arbitrary tag names without a registry or options for unimplemented custom semantics.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Custom tags use explicit name data rather than consumer-specific printer branches or replacement of foreign tag tables.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the required name and custom-tag role with an output example; paragraph and parameter-tag separation follows the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocUnknownTag}.
 */
export const createJSDocUnknownTag = (
  tagName: Identifier,
  comment?: string | readonly JSDocComment[],
): JSDocUnknownTag =>
  make("JSDocUnknownTag", {
    tagName,
    comment,
  });
