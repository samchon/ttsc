import type { TypeNode } from "./TypeNode";

/**
 * An intersection type, e.g. `A & B`.
 *
 * Built by {@link factory.createIntersectionTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface IntersectionTypeNode {
  /** Discriminant tag; always `"IntersectionTypeNode"`. */
  kind: "IntersectionTypeNode";

  /** The intersection constituents. */
  types: readonly TypeNode[];
}
