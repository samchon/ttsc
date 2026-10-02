import type {
  Identifier,
  JSDocComment,
  JSDocThisTag,
  JSDocTypeExpression,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocThisTag}: a `@this` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `this` when omitted. The
 * `typeExpression` supplies the brace-wrapped `this` type, and `comment` is the
 * trailing description, if any.
 *
 * With the default tag name and a `{Foo}` type expression, the printer emits:
 *
 * ```ts
 * @this {Foo}
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The required type-expression child and supplied identifier or this default record receiver annotation syntax without binding a receiver or validating a call.
 * @evidence contracts/common.md#clear-and-simple-design The adapter reuses the braced type payload and adds only defaulted spelling and description, avoiding receiver-state machinery.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This is a supported tag default rather than a fixed receiver identity, and construction does not rebind foreign functions.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains receiver type, default spelling and trailing description with an example; paragraph and native-tag separation follows the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `this`.
 * @param typeExpression The type expression.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocThisTag}.
 */
export const createJSDocThisTag = (
  tagName: Identifier | undefined,
  typeExpression: JSDocTypeExpression,
  comment?: string | readonly JSDocComment[],
): JSDocThisTag =>
  make("JSDocThisTag", {
    tagName: tagName ?? createIdentifier("this"),
    typeExpression,
    comment,
  });
