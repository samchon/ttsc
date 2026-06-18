import type { HeritageClause } from "../clauses/HeritageClause";
import type { ClassElement } from "../declarations/ClassElement";
import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";

/**
 * A class expression.
 *
 * Built by {@link factory.createClassExpression}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ClassExpression {
  /** Discriminant tag; always `"ClassExpression"`. */
  kind: "ClassExpression";

  /** Modifiers. */
  modifiers?: readonly ModifierLike[];

  /** Name. */
  name?: Identifier;

  /** TypeParameters. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** HeritageClauses. */
  heritageClauses?: readonly HeritageClause[];

  /** Members. */
  members: readonly ClassElement[];
}
