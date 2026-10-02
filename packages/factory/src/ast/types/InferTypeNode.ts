import type { TypeParameterDeclaration } from "./TypeParameterDeclaration";

/**
 * An `infer R` type.
 *
 * Built by {@link factory.createInferTypeNode}.
 *
 * @evidence contracts/common.md#principled-implementation A TypeParameterDeclaration supplies the inferred name and optional constraint; inference placement and semantics remain TypeScript checking concerns.
 * @evidence contracts/common.md#clear-and-simple-design The infer wrapper owns the keyword and delegates the declared variable to one shared node.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The inferred variable is supplied data without precomputed answers or consumer-name matching.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates infer R and explains the variable payload; member prose follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface InferTypeNode {
  /** Discriminant tag; always `"InferTypeNode"`. */
  kind: "InferTypeNode";

  /** Inferred type variable and its optional constraint. */
  typeParameter: TypeParameterDeclaration;
}
