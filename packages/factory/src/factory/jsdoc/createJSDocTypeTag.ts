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
 * @evidence contracts/common.md#principled-implementation The supplied braced type is retained and an absent identifier receives type, constructing an annotation without inferring or checking the documented value's type.
 * @evidence contracts/common.md#clear-and-simple-design Brace ownership stays with the type-expression child, leaving this adapter to map name, payload and optional description directly.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The type spelling is the documented default, and caller types are not replaced with known-fixture annotations or foreign checker results.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes the brace-wrapped payload and default name with an output example; separate paragraphs and parameter descriptions follow the documentation guidance.
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
