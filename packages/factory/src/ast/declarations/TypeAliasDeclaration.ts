import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { TypeNode } from "../types/TypeNode";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";

/**
 * A type alias declaration.
 *
 * Built by {@link factory.createTypeAliasDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeAliasDeclaration {
  /** Discriminant tag; always `"TypeAliasDeclaration"`. */
  kind: "TypeAliasDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: Identifier;

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** The type. */
  type: TypeNode;
}
