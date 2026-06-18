import type { TypeParameterDeclaration } from "./TypeParameterDeclaration";

/**
 * An `infer R` type.
 *
 * Built by {@link factory.createInferTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface InferTypeNode {
  /** Discriminant tag; always `"InferTypeNode"`. */
  kind: "InferTypeNode";

  /** TypeParameter. */
  typeParameter: TypeParameterDeclaration;
}
