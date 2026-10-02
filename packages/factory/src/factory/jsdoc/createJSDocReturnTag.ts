import type {
  Identifier,
  JSDocComment,
  JSDocReturnTag,
  JSDocTypeExpression,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocReturnTag}: a `@returns` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `returns` when omitted. The
 * `typeExpression` supplies the brace-wrapped return type, and `comment` is the
 * trailing description. When the type expression is omitted, the printer drops
 * the braces and emits only the tag name and comment.
 *
 * With the default tag name, a `{number}` type expression, and a `the count`
 * comment, the printer emits:
 *
 * ```ts
 * @returns {number} the count
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The adapter retains an optional braced return type and prose, preserving supplied aliases while using returns only for an absent name; it does not compare an executable return type.
 * @evidence contracts/common.md#clear-and-simple-design Optional type presence controls annotation payload directly, with no redundant return-presence flag or inference layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Returns is a supported name default, not a precomputed return value; caller types and descriptions are not adjusted for expected tests.
 * @evidence contracts/common.md#meaningful-documentation Native prose explicitly states omitted-type output and name defaulting with a typed example; separate paragraphs and parameter descriptions follow the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned node belongs to the caller; the builder retains no state, handle or task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Builds one node from its arguments in constant work; no algorithm is chosen.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call builds a fresh node; nothing is computed that another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Pure in-memory node construction; no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `returns`.
 * @param typeExpression The type expression, if any.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocReturnTag}.
 */
export const createJSDocReturnTag = (
  tagName: Identifier | undefined,
  typeExpression?: JSDocTypeExpression,
  comment?: string | readonly JSDocComment[],
): JSDocReturnTag =>
  make("JSDocReturnTag", {
    tagName: tagName ?? createIdentifier("returns"),
    typeExpression,
    comment,
  });
