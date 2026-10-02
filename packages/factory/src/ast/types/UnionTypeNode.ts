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
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface UnionTypeNode {
  /** Discriminant tag; always `"UnionTypeNode"`. */
  kind: "UnionTypeNode";

  /** The union constituents. */
  types: readonly TypeNode[];
}
