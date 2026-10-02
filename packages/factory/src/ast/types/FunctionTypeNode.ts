import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { TypeNode } from "./TypeNode";
import type { TypeParameterDeclaration } from "./TypeParameterDeclaration";

/**
 * A function type, e.g. `(a: number) => void`.
 *
 * Built by {@link factory.createFunctionTypeNode}.
 *
 * @evidence contracts/common.md#principled-implementation Ordered parameters, optional generics and a required return type represent arrow function-type syntax; binding and assignability are not encoded.
 * @evidence contracts/common.md#clear-and-simple-design The function type contains its signature only, sharing parameter and type declarations rather than evaluator state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The function-type discriminant carries no special callable name or test-only signature.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates the type syntax and identifies return annotation and argument order; separate member prose follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface FunctionTypeNode {
  /** Discriminant tag; always `"FunctionTypeNode"`. */
  kind: "FunctionTypeNode";

  /** The generic type parameters, if any. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** Function parameters in argument order. */
  parameters: readonly ParameterDeclaration[];

  /** Required return type after the arrow. */
  type: TypeNode;
}
