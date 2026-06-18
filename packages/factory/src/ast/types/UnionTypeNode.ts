import type { TypeNode } from "./TypeNode";

/**
 * A union type, e.g. `A | B`.
 *
 * Built by {@link factory.createUnionTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface UnionTypeNode {
  /** Discriminant tag; always `"UnionTypeNode"`. */
  kind: "UnionTypeNode";

  /** The union constituents. */
  types: readonly TypeNode[];
}
