import type {
  Identifier,
  JSDocComment,
  JSDocNameReference,
  JSDocSeeTag,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocSeeTag}: a `@see` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `see` when omitted. The
 * `nameExpression` is the referenced name, if any, and `comment` is the
 * trailing description.
 *
 * An absent name leaves a description-only annotation. The supplied reference
 * is retained without resolving its target.
 *
 * With the default tag name, a `Foo` name reference, and a `more` comment, the
 * printer emits:
 *
 * ```ts
 * @see Foo more
 * ```
 *
 * @evidence contracts/common.md#principled-implementation Mapping nameExpression to the optional name operand and preserving comment text constructs named or prose-only see tags, with a see default but no target resolution.
 * @evidence contracts/common.md#clear-and-simple-design The reference wrapper owns target syntax; this adapter only supplies the tag heading and description without another lookup or name representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts See is a supported spelling default, while reference targets remain supplied rather than guessed documentation destinations or consumer-specific lookup fallbacks.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains omitted-name output and unresolved references with a named-tag example; paragraph and parameter-tag separation follows the documentation guidance.
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `see`.
 * @param nameExpression The referenced name, if any.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocSeeTag}.
 */
export const createJSDocSeeTag = (
  tagName: Identifier | undefined,
  nameExpression: JSDocNameReference | undefined,
  comment?: string | readonly JSDocComment[],
): JSDocSeeTag =>
  make("JSDocSeeTag", {
    tagName: tagName ?? createIdentifier("see"),
    name: nameExpression,
    comment,
  });
