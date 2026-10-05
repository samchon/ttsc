import type { TypeNode } from "./TypeNode";

/**
 * A tuple type, e.g. `[number, string]`.
 *
 * Built by {@link factory.createTupleTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation An ordered TypeNode array preserves tuple position and permits supported named/optional/rest wrappers; valid ordering combinations remain caller responsibilities.
 * @evidence contracts/common.md#clear-and-simple-design One element sequence delegates each position's syntax to its child type.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Positions retain supplied type data without consumer-specific tuple lengths or values.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates positional tuple spelling and identifies its elements; member spacing follows the documentation skill.
 */
export interface TupleTypeNode {
  /** Discriminant tag; always `"TupleTypeNode"`. */
  kind: "TupleTypeNode";

  /** The tuple element types. */
  elements: readonly TypeNode[];
}
