import type { TypeNode } from "./TypeNode";

/**
 * An array type, e.g. `T[]`.
 *
 * Built by {@link factory.createArrayTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The array kind wraps one TypeNode element, preserving array nesting without implying assignability.
 * @evidence contracts/common.md#clear-and-simple-design A single element field owns array syntax while the child owns its type form.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The kind denotes array syntax, with no special element types for consumers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates T[] and documents its element and constructor; member separation follows the documentation skill.
 */
export interface ArrayTypeNode {
  /** Discriminant tag; always `"ArrayTypeNode"`. */
  kind: "ArrayTypeNode";

  /** The element type. */
  elementType: TypeNode;
}
