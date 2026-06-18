import type { Identifier } from "../names/Identifier";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@satisfies` JSDoc tag.
 *
 * Built by {@link factory.createJSDocSatisfiesTag}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface JSDocSatisfiesTag {
  /** Discriminant tag; always `"JSDocSatisfiesTag"`. */
  kind: "JSDocSatisfiesTag";

  /** The tag name, e.g. `satisfies`. */
  tagName: Identifier;

  /** The type expression. */
  typeExpression: JSDocTypeExpression;

  /** The trailing comment, if any. */
  comment?: string | readonly JSDocComment[];
}
