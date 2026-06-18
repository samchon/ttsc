import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { Modifier } from "../names/Modifier";
import type { TypeNode } from "./TypeNode";
import type { TypeParameterDeclaration } from "./TypeParameterDeclaration";

/**
 * A constructor type, e.g. `new (a: A) => T`.
 *
 * Built by {@link factory.createConstructorTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ConstructorTypeNode {
  /** Discriminant tag; always `"ConstructorTypeNode"`. */
  kind: "ConstructorTypeNode";

  /** Modifiers. */
  modifiers?: readonly Modifier[];

  /** TypeParameters. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** Parameters. */
  parameters: readonly ParameterDeclaration[];

  /** Type. */
  type: TypeNode;
}
