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
