import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { TypeNode } from "./TypeNode";
import type { TypeParameterDeclaration } from "./TypeParameterDeclaration";

/**
 * A construct signature member, e.g. `new (a: A): T`.
 *
 * Built by {@link factory.createConstructSignature}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ConstructSignatureDeclaration {
  /** Discriminant tag; always `"ConstructSignature"`. */
  kind: "ConstructSignature";

  /** TypeParameters. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** Parameters. */
  parameters: readonly ParameterDeclaration[];

  /** Type. */
  type?: TypeNode;
}
