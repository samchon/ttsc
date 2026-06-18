import type { EntityName } from "../names/EntityName";

/**
 * A `typeof` type query (type space), e.g. `typeof value`.
 *
 * Built by {@link factory.createTypeQueryNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeQueryNode {
  /** Discriminant tag; always `"TypeQueryNode"`. */
  kind: "TypeQueryNode";

  /** The queried entity name. */
  exprName: EntityName;
}
