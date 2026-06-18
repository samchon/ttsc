import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { TypeNode } from "./TypeNode";
import type { TypeParameterDeclaration } from "./TypeParameterDeclaration";

/**
 * A function type, e.g. `(a: number) => void`.
 *
 * Built by {@link factory.createFunctionTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface FunctionTypeNode {
  /** Discriminant tag; always `"FunctionTypeNode"`. */
  kind: "FunctionTypeNode";

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** The parameters. */
  parameters: readonly ParameterDeclaration[];

  /** The type. */
  type: TypeNode;
}
