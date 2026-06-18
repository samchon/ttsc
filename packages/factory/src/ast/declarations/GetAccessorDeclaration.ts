import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { ModifierLike } from "../names/ModifierLike";
import type { PropertyName } from "../names/PropertyName";
import type { Block } from "../statements/Block";
import type { TypeNode } from "../types/TypeNode";

/**
 * A class getter declaration.
 *
 * Built by {@link factory.createGetAccessorDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface GetAccessorDeclaration {
  /** Discriminant tag; always `"GetAccessorDeclaration"`. */
  kind: "GetAccessorDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The name. */
  name: PropertyName;

  /** The parameters. */
  parameters: readonly ParameterDeclaration[];

  /** The type. */
  type?: TypeNode;

  /** The body. */
  body?: Block;
}
