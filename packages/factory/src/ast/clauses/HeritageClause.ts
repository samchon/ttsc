import type { SyntaxKind } from "../../syntax";
import type { ExpressionWithTypeArguments } from "../types/ExpressionWithTypeArguments";

/**
 * An `extends` or `implements` clause of a class or interface.
 *
 * Built by {@link factory.createHeritageClause}.
 *
 * The token should denote extends or implements; the broad SyntaxKind field
 * does not enforce that restriction or validate the referenced bases.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Ordered base expressions and a clause token preserve heritage spelling; the broad token representation leaves extends/implements validity to callers.
 * @evidence contracts/common.md#clear-and-simple-design The clause owns its keyword and ordered bases, while each base owns its type arguments.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Keyword and kind are syntax values, with no consumer-specific base types embedded.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states the keyword restriction and unchecked bases; member paragraphs follow the documentation skill.
 */
export interface HeritageClause {
  /** Discriminant tag; always `"HeritageClause"`. */
  kind: "HeritageClause";

  /** Either `extends` or `implements`. */
  token: SyntaxKind;

  /** The referenced base types. */
  types: readonly ExpressionWithTypeArguments[];
}
