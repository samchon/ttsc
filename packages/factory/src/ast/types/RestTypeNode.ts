import type { TypeNode } from "./TypeNode";

/**
 * A rest tuple element type, e.g. `...T`.
 *
 * Built by {@link factory.createRestTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface RestTypeNode {
  /** Discriminant tag; always `"RestTypeNode"`. */
  kind: "RestTypeNode";

  /** Type. */
  type: TypeNode;
}
