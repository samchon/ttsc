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
