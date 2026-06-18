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
 * With the default tag name, a `Foo` name reference, and a `more` comment, the
 * printer emits:
 *
 * ```ts
 * @see Foo more
 * ```
 *
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
