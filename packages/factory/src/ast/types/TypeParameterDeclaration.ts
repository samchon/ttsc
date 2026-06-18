import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { TypeNode } from "./TypeNode";

/**
 * A generic type parameter declaration, e.g. `<T extends U = D>`.
 *
 * Built by {@link factory.createTypeParameterDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeParameterDeclaration {
  /** Discriminant tag; always `"TypeParameterDeclaration"`. */
  kind: "TypeParameterDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: Identifier;

  /** The `extends` constraint, if any. */
  constraint?: TypeNode;

  /** The default type, if any. */
  default?: TypeNode;
}
