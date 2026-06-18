import type { TypeElement } from "./TypeElement";

/**
 * An inline object type, e.g. `{ x: number }`.
 *
 * Built by {@link factory.createTypeLiteralNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeLiteralNode {
  /** Discriminant tag; always `"TypeLiteralNode"`. */
  kind: "TypeLiteralNode";

  /** The members. */
  members: readonly TypeElement[];
}
