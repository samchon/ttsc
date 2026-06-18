import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { ModifierLike } from "../names/ModifierLike";
import type { PropertyName } from "../names/PropertyName";
import type { Block } from "../statements/Block";

/**
 * A class setter declaration.
 *
 * Built by {@link factory.createSetAccessorDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface SetAccessorDeclaration {
  /** Discriminant tag; always `"SetAccessorDeclaration"`. */
  kind: "SetAccessorDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: PropertyName;

  /** The parameters. */
  parameters: readonly ParameterDeclaration[];

  /** The body. */
  body?: Block;
}
