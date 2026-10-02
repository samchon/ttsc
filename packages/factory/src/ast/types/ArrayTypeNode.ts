import type { TypeNode } from "./TypeNode";

/**
 * An array type, e.g. `T[]`.
 *
 * Built by {@link factory.createArrayTypeNode}.
 *
 * @evidence contracts/common.md#principled-implementation The array kind wraps one TypeNode element, preserving array nesting without implying assignability.
 * @evidence contracts/common.md#clear-and-simple-design A single element field owns array syntax while the child owns its type form.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The kind denotes array syntax, with no special element types for consumers.
 * @evidence contracts/common.md#meaningful-documentation JSDoc illustrates T[] and documents its element and constructor; member separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ArrayTypeNode {
  /** Discriminant tag; always `"ArrayTypeNode"`. */
  kind: "ArrayTypeNode";

  /** The element type. */
  elementType: TypeNode;
}
