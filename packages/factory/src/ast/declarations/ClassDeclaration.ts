import type { HeritageClause } from "../clauses/HeritageClause";
import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";
import type { ClassElement } from "./ClassElement";

/**
 * A class declaration.
 *
 * Built by {@link factory.createClassDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ClassDeclaration {
  /** Discriminant tag; always `"ClassDeclaration"`. */
  kind: "ClassDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name?: Identifier;

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** The `extends` / `implements` clauses, if any. */
  heritageClauses?: readonly HeritageClause[];

  /** The members. */
  members: readonly ClassElement[];
}
