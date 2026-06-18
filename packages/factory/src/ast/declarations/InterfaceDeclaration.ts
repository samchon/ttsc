import type { HeritageClause } from "../clauses/HeritageClause";
import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { TypeElement } from "../types/TypeElement";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";

/**
 * An interface declaration.
 *
 * Built by {@link factory.createInterfaceDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface InterfaceDeclaration {
  /** Discriminant tag; always `"InterfaceDeclaration"`. */
  kind: "InterfaceDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: Identifier;

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** The `extends` / `implements` clauses, if any. */
  heritageClauses?: readonly HeritageClause[];

  /** The members. */
  members: readonly TypeElement[];
}
