import type { TypeNode } from "./TypeNode";

/**
 * A parenthesized type, e.g. `(A | B)`.
 *
 * Built by {@link factory.createParenthesizedType}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ParenthesizedTypeNode {
  /** Discriminant tag; always `"ParenthesizedTypeNode"`. */
  kind: "ParenthesizedTypeNode";

  /** The type. */
  type: TypeNode;
}
