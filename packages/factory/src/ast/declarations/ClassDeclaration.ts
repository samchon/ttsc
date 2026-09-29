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
 * A missing name represents an anonymous declaration, meaningful for a
 * default export. The shape does not enforce that surrounding modifier.
 *
 * @evidence contracts/common.md#principled-implementation Optional name, generics and heritage with ordered members preserve class declaration clauses; anonymous-name legality and member compatibility remain unchecked.
 * @evidence contracts/common.md#clear-and-simple-design Each class-header clause and member sequence has one field, with member details owned by ClassElement.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Class names and bases are caller data rather than special consumer classes or patched runtime constructors.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explains anonymous-name context and optional clauses; member separation follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ClassDeclaration {
  /** Discriminant tag; always `"ClassDeclaration"`. */
  kind: "ClassDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** Class identifier; absent for an anonymous default-export declaration. */
  name?: Identifier;

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** The `extends` / `implements` clauses, if any. */
  heritageClauses?: readonly HeritageClause[];

  /** Class members in printed order. */
  members: readonly ClassElement[];
}
