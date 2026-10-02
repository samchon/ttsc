import type { TypeNode } from "./TypeNode";

/**
 * A union type, e.g. `A | B`.
 *
 * Built by {@link factory.createUnionTypeNode}.
 *
 * @evidence contracts/common.md#principled-implementation An ordered TypeNode array preserves union operands without evaluating, deduplicating or resolving their semantic union.
 * @evidence contracts/common.md#clear-and-simple-design One constituent sequence delegates operand syntax to child types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Constituents retain caller data instead of hardcoded union results.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates A | B and labels the constituent collection; native separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface UnionTypeNode {
  /** Discriminant tag; always `"UnionTypeNode"`. */
  kind: "UnionTypeNode";

  /** The union constituents. */
  types: readonly TypeNode[];
}
