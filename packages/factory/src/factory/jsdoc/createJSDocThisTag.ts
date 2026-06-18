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
