import type { Identifier } from "../names/Identifier";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@template` JSDoc tag.
 *
 * Built by {@link factory.createJSDocTemplateTag}.
 *
 * A present constraint is printed before the comma-separated parameter list;
 * omission removes that shared prefix. Parameter declarations are retained in
 * order, without checking generic binding or constraint applicability.
 *
 * @evidence contracts/common.md#principled-implementation An optional braced constraint and ordered type-parameter nodes express the printed template payload; the representation itself does not establish binding validity or how a consumer applies a shared constraint.
 * @evidence contracts/common.md#clear-and-simple-design One constraint prefix and one parameter list expose the tag's two type roles without storing an inferred per-parameter constraint mapping.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Generic information remains supplied syntax instead of a guessed successful constraint check or a patched foreign type-parameter declaration.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies constraint placement, parameter order and unchecked binding semantics; paragraph and member separation follows the documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocTemplateTag {
  /** Discriminant tag; always `"JSDocTemplateTag"`. */
  kind: "JSDocTemplateTag";

  /** The tag name, e.g. `template`. */
  tagName: Identifier;

  /** The shared constraint, if any. */
  constraint?: JSDocTypeExpression;

  /** The declared type parameters. */
  typeParameters: readonly TypeParameterDeclaration[];

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
