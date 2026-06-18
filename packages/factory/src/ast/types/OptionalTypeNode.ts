import type { TypeNode } from "./TypeNode";

/**
 * An optional tuple element type, e.g. `T?`.
 *
 * Built by {@link factory.createOptionalTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface OptionalTypeNode {
  /** Discriminant tag; always `"OptionalTypeNode"`. */
  kind: "OptionalTypeNode";

  /** Type. */
  type: TypeNode;
}
