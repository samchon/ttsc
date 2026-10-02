import type { EntityName } from "../names/EntityName";

/**
 * A `typeof` type query (type space), e.g. `typeof value`.
 *
 * Built by {@link factory.createTypeQueryNode}.
 *
 * @evidence contracts/common.md#principled-implementation EntityName retains a bare or qualified name after type-space typeof; this shape does not evaluate a runtime expression or resolve its binding.
 * @evidence contracts/common.md#clear-and-simple-design One queried-name field delegates qualification to EntityName without compiler state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The query records supplied names instead of substituting fixture-specific inferred types.
 * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes type-space typeof from value expressions and identifies the queried name; native spacing follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeQueryNode {
  /** Discriminant tag; always `"TypeQueryNode"`. */
  kind: "TypeQueryNode";

  /** The queried entity name. */
  exprName: EntityName;
}
