import type {
  Identifier,
  JSDocComment,
  JSDocSatisfiesTag,
  JSDocTypeExpression,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocSatisfiesTag}: a `@satisfies` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `satisfies` when omitted. The
 * `typeExpression` supplies the brace-wrapped target type, and `comment` is the
 * trailing description.
 *
 * With the default tag name, a `{Foo}` type expression, and an `ok` comment,
 * the printer emits:
 *
 * ```ts
 * @satisfies {Foo} ok
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Retaining the required target type and defaulting an absent identifier to satisfies records annotation intent without calculating assignability or producing an executable satisfies expression.
 * @evidence contracts/common.md#clear-and-simple-design The target remains an existing braced type node; no boolean satisfaction result or second expression representation is stored.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Satisfies is an annotation default rather than a fabricated successful check, and supplied target types do not trigger foreign checker mutations.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains target type, default name and trailing description with an example; paragraph and native-tag separation follows the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `satisfies`.
 * @param typeExpression The type expression.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocSatisfiesTag}.
 */
export const createJSDocSatisfiesTag = (
  tagName: Identifier | undefined,
  typeExpression: JSDocTypeExpression,
  comment?: string | readonly JSDocComment[],
): JSDocSatisfiesTag =>
  make("JSDocSatisfiesTag", {
    tagName: tagName ?? createIdentifier("satisfies"),
    typeExpression,
    comment,
  });
