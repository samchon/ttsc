import type { ParameterDeclaration } from "../clauses/ParameterDeclaration";
import type { Modifier } from "../names/Modifier";
import type { TypeNode } from "./TypeNode";
import type { TypeParameterDeclaration } from "./TypeParameterDeclaration";

/**
 * A constructor type, e.g. `new (a: A) => T`.
 *
 * Built by {@link factory.createConstructorTypeNode}.
 *
 * @evidence contracts/common.md#principled-implementation Parameters and required constructed type preserve new-call type syntax; optional modifier tokens remain permissive caller data rather than validated keywords.
 * @evidence contracts/common.md#clear-and-simple-design Construction parts are explicit fields sharing the existing parameter and type representations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The new-call category is a language distinction, without consumer-specific constructor exceptions.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates new syntax and explains optional clauses and result type; member separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ConstructorTypeNode {
  /** Discriminant tag; always `"ConstructorTypeNode"`. */
  kind: "ConstructorTypeNode";

  /** Leading modifier tokens, such as abstract; omitted when absent. */
  modifiers?: readonly Modifier[];

  /** Generic parameters in declaration order, if present. */
  typeParameters?: readonly TypeParameterDeclaration[];

  /** Constructor parameters in argument order. */
  parameters: readonly ParameterDeclaration[];

  /** Type produced by construction. */
  type: TypeNode;
}
