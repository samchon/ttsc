/**
 * The `this` type.
 *
 * Built by {@link factory.createThisTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ThisTypeNode {
  /** Discriminant tag; always `"ThisTypeNode"`. */
  kind: "ThisTypeNode";
}
