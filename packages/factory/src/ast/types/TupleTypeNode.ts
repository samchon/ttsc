import type { TypeNode } from "./TypeNode";

/**
 * A tuple type, e.g. `[number, string]`.
 *
 * Built by {@link factory.createTupleTypeNode}.
 *
 * @evidence contracts/common.md#principled-implementation An ordered TypeNode array preserves tuple position and permits supported named/optional/rest wrappers; valid ordering combinations remain caller responsibilities.
 * @evidence contracts/common.md#clear-and-simple-design One element sequence delegates each position's syntax to its child type.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Positions retain supplied type data without consumer-specific tuple lengths or values.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates positional tuple spelling and identifies its elements; member spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TupleTypeNode {
  /** Discriminant tag; always `"TupleTypeNode"`. */
  kind: "TupleTypeNode";

  /** The tuple element types. */
  elements: readonly TypeNode[];
}
