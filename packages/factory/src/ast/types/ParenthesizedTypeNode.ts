import type { TypeNode } from "./TypeNode";

/**
 * A parenthesized type, e.g. `(A | B)`.
 *
 * Built by {@link factory.createParenthesizedType}.
 *
 * @evidence contracts/common.md#principled-implementation An explicit wrapper records grouping independently of the enclosed TypeNode, preserving parentheses in printed type syntax.
 * @evidence contracts/common.md#clear-and-simple-design One operand field delegates all enclosed type structure to its existing node.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Grouping has no consumer-specific parenthesis exception or semantic substitution.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates grouped union syntax and identifies the enclosed type; native spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ParenthesizedTypeNode {
  /** Discriminant tag; always `"ParenthesizedTypeNode"`. */
  kind: "ParenthesizedTypeNode";

  /** The type. */
  type: TypeNode;
}
