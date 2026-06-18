import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { Token } from "../names/Token";
import type { Block } from "../statements/Block";
import type { TypeNode } from "../types/TypeNode";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";

/**
 * A function declaration.
 *
 * Built by {@link factory.createFunctionDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface FunctionDeclaration {
  /** Discriminant tag; always `"FunctionDeclaration"`. */
  kind: "FunctionDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The generator marker (`*`), if any. */
  asteriskToken?: Token;

  /** The name. */
  name?: Identifier;

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** The parameters. */
  parameters: readonly ParameterDeclaration[];

  /** The type. */
  type?: TypeNode;

  /** The body. */
  body?: Block;
}
