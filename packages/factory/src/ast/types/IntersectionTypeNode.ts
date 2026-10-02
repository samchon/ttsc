import type { TypeNode } from "./TypeNode";

/**
 * An intersection type, e.g. `A & B`.
 *
 * Built by {@link factory.createIntersectionTypeNode}.
 *
 * @evidence contracts/common.md#principled-implementation An ordered TypeNode collection records intersection operands without computing or simplifying their semantic intersection.
 * @evidence contracts/common.md#clear-and-simple-design One constituent array retains operand order; individual nodes own their forms.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Constituents are supplied syntax rather than fixture-specific intersection results.
 * @evidence contracts/common.md#meaningful-documentation JSDoc provides A & B and labels the constituent collection; native spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface IntersectionTypeNode {
  /** Discriminant tag; always `"IntersectionTypeNode"`. */
  kind: "IntersectionTypeNode";

  /** The intersection constituents. */
  types: readonly TypeNode[];
}
