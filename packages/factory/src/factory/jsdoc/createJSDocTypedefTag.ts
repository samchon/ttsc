import type {
  Identifier,
  JSDocComment,
  JSDocTypeExpression,
  JSDocTypeLiteral,
  JSDocTypedefTag,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocTypedefTag}: a `@typedef` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `typedef` when omitted. The
 * `typeExpression` is the aliased type, either a brace-wrapped type expression
 * or a {@link JSDocTypeLiteral}. The `fullName` is the alias name, printed after
 * the type, and `comment` is the trailing description.
 *
 * With the default tag name, a `{number}` type expression, and a `Count` name,
 * the printer emits:
 *
 * ```ts
 * @typedef {number} Count
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `typedef`.
 * @param typeExpression The aliased type, if any.
 * @param fullName The full alias name, if any.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocTypedefTag}.
 */
export const createJSDocTypedefTag = (
  tagName: Identifier | undefined,
  typeExpression?: JSDocTypeExpression | JSDocTypeLiteral,
  fullName?: Identifier,
  comment?: string | readonly JSDocComment[],
): JSDocTypedefTag =>
  make("JSDocTypedefTag", {
    tagName: tagName ?? createIdentifier("typedef"),
    typeExpression,
    fullName,
    comment,
  });
