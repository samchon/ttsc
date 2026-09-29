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
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface IntersectionTypeNode {
  /** Discriminant tag; always `"IntersectionTypeNode"`. */
  kind: "IntersectionTypeNode";

  /** The intersection constituents. */
  types: readonly TypeNode[];
}
