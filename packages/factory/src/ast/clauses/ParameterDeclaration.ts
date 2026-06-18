import type { Expression } from "../expressions/Expression";
import type { Identifier } from "../names/Identifier";
import type { ModifierLike } from "../names/ModifierLike";
import type { Token } from "../names/Token";
import type { TypeNode } from "../types/TypeNode";

/**
 * A function/method parameter declaration.
 *
 * Built by {@link factory.createParameterDeclaration}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ParameterDeclaration {
  /** Discriminant tag; always `"ParameterDeclaration"`. */
  kind: "ParameterDeclaration";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The rest marker (`...`), if any. */
  dotDotDotToken?: Token;

  /** The name. */
  name: Identifier;

  /** The optional marker (`?`), if any. */
  questionToken?: Token;

  /** The type. */
  type?: TypeNode;

  /** The initializer, if any. */
  initializer?: Expression;
}
