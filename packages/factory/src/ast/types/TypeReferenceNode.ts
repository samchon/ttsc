import type { EntityName } from "../names/EntityName";
import type { TypeNode } from "./TypeNode";

/**
 * A reference to a named type, e.g. `Array<T>`.
 *
 * Built by {@link factory.createTypeReferenceNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeReferenceNode {
  /** Discriminant tag; always `"TypeReferenceNode"`. */
  kind: "TypeReferenceNode";

  /** The referenced type name. */
  typeName: EntityName;

  /** The generic type arguments, if any. */
  typeArguments?: readonly TypeNode[];
}
