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
 * `constraint` is the shared brace-wrapped prefix, if any. Its application to
 * declared parameters depends on the JSDoc consumer. The `typeParameters` are
 * the declared names, and `comment` is the trailing description.
 *
 * Parameter arrays and child nodes are retained by reference; binding and
 * constraint applicability are not checked here.
 *
 * With the default tag name, a `{string}` constraint, and a single `T` type
 * parameter, the printer emits:
 *
 * ```ts
 * @template {string} T
 * ```
 *
 * @evidence contracts/common.md#principled-implementation The optional constraint and ordered parameter declarations are retained with a supplied identifier or template default, recording syntax without claiming parameter binding or constraint applicability.
 * @evidence contracts/common.md#clear-and-simple-design One prefix operand and one parameter list expose the printed roles without an inferred per-parameter constraint map or additional generic-policy layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Template is the documented tag default; supplied constraints are not replaced by expected successful checks or foreign generic-declaration mutations.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains constraint placement, consumer-owned semantics and retained references with an example; separate paragraphs and native tags follow the documentation guidance.
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
