import type { Identifier, JSDocComment, JSDocReadonlyTag } from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocReadonlyTag}: a `@readonly` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `readonly` when omitted. The
 * `comment` is the trailing description, if any.
 *
 * With the default tag name and no comment, the printer emits:
 *
 * ```ts
 * @readonly
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The readonly kind and supplied or defaulted identifier record a documentation marker; retaining comment text does not freeze values or enforce language mutability.
 * @evidence contracts/common.md#clear-and-simple-design The adapter contains only name defaulting and description storage, with no target object or mutation policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The readonly default is tag syntax, and construction never replaces foreign setters or freezes caller-owned values.
 * @evidence contracts/common.md#meaningful-documentation Native prose and parameters explain the default spelling and optional description with a bare-tag example; separate paragraphs follow the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `readonly`.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocReadonlyTag}.
 */
export const createJSDocReadonlyTag = (
  tagName: Identifier | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocReadonlyTag =>
  make("JSDocReadonlyTag", {
    tagName: tagName ?? createIdentifier("readonly"),
    comment,
  });
