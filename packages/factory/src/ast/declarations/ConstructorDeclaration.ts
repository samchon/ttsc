import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { ModifierLike } from "../names/ModifierLike";
import type { Block } from "../statements/Block";

/**
 * A class constructor declaration.
 *
 * Built by {@link factory.createConstructorDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ConstructorDeclaration {
  /** Discriminant tag; always `"ConstructorDeclaration"`. */
  kind: "ConstructorDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The parameters. */
  parameters: readonly ParameterDeclaration[];

  /** The body. */
  body?: Block;
}
