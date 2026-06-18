import type { Identifier } from "../names/Identifier";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";
import type { JSDocComment } from "./JSDocComment";
import type { JSDocTypeExpression } from "./JSDocTypeExpression";

/**
 * A `@template` JSDoc tag.
 *
 * Built by {@link factory.createJSDocTemplateTag}.
 *
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
