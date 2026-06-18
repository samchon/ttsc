import type {
  Identifier,
  JSDocComment,
  JSDocTemplateTag,
  JSDocTypeExpression,
  TypeParameterDeclaration,
} from "../../ast";
import { make } from "../internal/make";
import { createIdentifier } from "../names/createIdentifier";

/**
 * Create a {@link JSDocTemplateTag}: a `@template` JSDoc tag.
 *
 * The `tagName` defaults to an identifier named `template` when omitted. The
 * `constraint` is the shared brace-wrapped bound applied to every declared
 * parameter, if any. The `typeParameters` are the declared names, and `comment`
 * is the trailing description.
 *
 * With the default tag name, a `{string}` constraint, and a single `T` type
 * parameter, the printer emits:
 *
 * ```ts
 * @template {string} T
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param tagName The tag name; defaults to `template`.
 * @param constraint The shared constraint, if any.
 * @param typeParameters The declared type parameters.
 * @param comment The trailing comment, if any.
 * @returns The created {@link JSDocTemplateTag}.
 */
export const createJSDocTemplateTag = (
  tagName: Identifier | undefined,
  constraint: JSDocTypeExpression | undefined,
  typeParameters: readonly TypeParameterDeclaration[],
  comment?: string | readonly JSDocComment[],
): JSDocTemplateTag =>
  make("JSDocTemplateTag", {
    tagName: tagName ?? createIdentifier("template"),
    constraint,
    typeParameters,
    comment,
  });
