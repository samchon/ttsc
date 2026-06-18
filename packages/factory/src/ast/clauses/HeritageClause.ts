import type { SyntaxKind } from "../../syntax";
import type { ExpressionWithTypeArguments } from "../types/ExpressionWithTypeArguments";

/**
 * An `extends` or `implements` clause of a class or interface.
 *
 * Built by {@link factory.createHeritageClause}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface HeritageClause {
  /** Discriminant tag; always `"HeritageClause"`. */
  kind: "HeritageClause";

  /** Either `extends` or `implements`. */
  token: SyntaxKind;

  /** The referenced base types. */
  types: readonly ExpressionWithTypeArguments[];
}
