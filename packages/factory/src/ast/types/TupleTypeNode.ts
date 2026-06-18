import type { TypeNode } from "./TypeNode";

/**
 * A tuple type, e.g. `[number, string]`.
 *
 * Built by {@link factory.createTupleTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TupleTypeNode {
  /** Discriminant tag; always `"TupleTypeNode"`. */
  kind: "TupleTypeNode";

  /** The tuple element types. */
  elements: readonly TypeNode[];
}
