import type { TypeNode } from "./TypeNode";

/**
 * A rest tuple element type, e.g. `...T`.
 *
 * Built by {@link factory.createRestTypeNode}.
 *
 * @evidence contracts/common.md#principled-implementation A wrapper attaches tuple rest syntax to its TypeNode operand; the shape does not establish that the operand is a permitted rest type.
 * @evidence contracts/common.md#clear-and-simple-design One operand field delegates type structure while the wrapper owns the rest marker.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The rest category is language syntax, with no fixture-specific tuple behavior.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates ...T and labels the rest operand; separated comments follow the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface RestTypeNode {
  /** Discriminant tag; always `"RestTypeNode"`. */
  kind: "RestTypeNode";

  /** Tuple rest operand printed after the leading ... marker. */
  type: TypeNode;
}
