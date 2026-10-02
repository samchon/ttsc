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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface TypeQueryNode {
  /** Discriminant tag; always `"TypeQueryNode"`. */
  kind: "TypeQueryNode";

  /** The queried entity name. */
  exprName: EntityName;
}
