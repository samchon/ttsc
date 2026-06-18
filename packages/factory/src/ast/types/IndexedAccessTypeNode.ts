import type { TypeNode } from "./TypeNode";

/**
 * An indexed access type, e.g. `T[K]`.
 *
 * Built by {@link factory.createIndexedAccessTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface IndexedAccessTypeNode {
  /** Discriminant tag; always `"IndexedAccessTypeNode"`. */
  kind: "IndexedAccessTypeNode";

  /** The object type. */
  objectType: TypeNode;

  /** The index type. */
  indexType: TypeNode;
}
