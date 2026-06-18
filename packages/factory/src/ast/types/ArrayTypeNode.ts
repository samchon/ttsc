import type { TypeNode } from "./TypeNode";

/**
 * An array type, e.g. `T[]`.
 *
 * Built by {@link factory.createArrayTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ArrayTypeNode {
  /** Discriminant tag; always `"ArrayTypeNode"`. */
  kind: "ArrayTypeNode";

  /** The element type. */
  elementType: TypeNode;
}
