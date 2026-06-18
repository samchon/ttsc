import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { TypeNode } from "./TypeNode";
import type { TypeParameterDeclaration } from "./TypeParameterDeclaration";

/**
 * A call signature member, e.g. `(a: A): T`.
 *
 * Built by {@link factory.createCallSignature}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface CallSignatureDeclaration {
  /** Discriminant tag; always `"CallSignature"`. */
  kind: "CallSignature";

  /** TypeParameters. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** Parameters. */
  parameters: readonly ParameterDeclaration[];

  /** Type. */
  type?: TypeNode;
}
