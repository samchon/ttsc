import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { ModifierLike } from "../names/ModifierLike";
import type { Block } from "../statements/Block";
import type { TypeNode } from "../types/TypeNode";
import type { TypeParameterDeclaration } from "../types/TypeParameterDeclaration";
import type { Expression } from "./Expression";

/**
 * An arrow function expression.
 *
 * Built by {@link factory.createArrowFunction}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ArrowFunction {
  /** Discriminant tag; always `"ArrowFunction"`. */
  kind: "ArrowFunction";

  /** The leading modifiers and decorators, if any. */
  modifiers?: readonly ModifierLike[];

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** The parameters. */
  parameters: readonly ParameterDeclaration[];

  /** The type. */
  type?: TypeNode;

  /** The body. */
  body: Block | Expression;
}
