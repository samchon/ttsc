import type {
  Identifier,
  JSDocComment,
  JSDocEnumTag,
  JSDocTypeExpression,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocEnumTag}: an `@enum` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `enum` when omitted. The
 * `typeExpression` supplies the brace-wrapped member type, and `comment` is the
 * trailing description, if any.
 *
 * With the default tag name and a `{number}` type expression, the printer
 * emits:
 *
 * ```ts
 * @enum {number}
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `enum`.
 * @param typeExpression The type expression.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocEnumTag}.
 * @evidence contracts/common.md#principled-implementation The required braced type is retained with an explicit identifier or enum default, recording a member-type annotation rather than constructing or checking enum values.
 * @evidence contracts/common.md#clear-and-simple-design A reused type-expression child keeps brace syntax separate from tag spelling and description, with no duplicate value-set representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The enum default denotes annotation grammar; actual member types are supplied and no expected enum values substitute for them.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the member-type role and default name with a braced-type example; separate paragraphs and native tags follow the documentation guidance.
 */
export const createJSDocEnumTag = (
  tagName: Identifier | undefined,
  typeExpression: JSDocTypeExpression,
  comment?: string | readonly JSDocComment[],
): JSDocEnumTag =>
  make("JSDocEnumTag", {
    tagName: tagName ?? createIdentifier("enum"),
    typeExpression,
    comment,
  });
