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
 * @evidence contracts/common.md#principled-implementation Name, optional generic/heritage clauses and ordered TypeElements preserve interface syntax, including explicit non-emitted members; broad heritage legality remains unchecked.
 * @evidence contracts/common.md#clear-and-simple-design Header clauses and member sequence have separate fields, sharing the common type-element and heritage representations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Interface names and bases are caller data rather than fixture-specific compatibility declarations.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies interfaces and comments distinguish extends-only heritage intent and member order; spacing follows the documentation skill.
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

  /**
   * Heritage clauses; valid interface syntax uses extends rather than
   * implements.
   */
  heritageClauses?: readonly HeritageClause[];

  /** Interface members in printed order. */
  members: readonly TypeElement[];
}
