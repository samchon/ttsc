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
