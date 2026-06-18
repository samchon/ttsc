import type {
  Identifier,
  JSDocComment,
  JSDocTypeExpression,
  JSDocTypeTag,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocTypeTag}: a `@type` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `type` when omitted. The
 * `typeExpression` supplies the brace-wrapped type, and `comment` is the
 * trailing description, if any.
 *
 * With the default tag name and a `{number}` type expression, the printer
 * emits:
 *
 * ```ts
 * @type {number}
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `type`.
 * @param typeExpression The type expression.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocTypeTag}.
 */
export const createJSDocTypeTag = (
  tagName: Identifier | undefined,
  typeExpression: JSDocTypeExpression,
  comment?: string | readonly JSDocComment[],
): JSDocTypeTag =>
  make("JSDocTypeTag", {
    tagName: tagName ?? createIdentifier("type"),
    typeExpression,
    comment,
  });
