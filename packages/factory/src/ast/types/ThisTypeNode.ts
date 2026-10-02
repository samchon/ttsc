/**
 * The `this` type.
 *
 * Built by {@link factory.createThisTypeNode}.
 *
 * @evidence contracts/common.md#principled-implementation A distinct kind records the this type rather than a value identifier; applicability in its surrounding type context is not checked here.
 * @evidence contracts/common.md#clear-and-simple-design A kind-only shape needs no payload because its printed spelling is fixed language syntax.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Fixed this spelling is a language keyword, not a fixture-derived type answer.
 * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes type-space this and its constructor; prose/tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ThisTypeNode {
  /** Discriminant tag; always `"ThisTypeNode"`. */
  kind: "ThisTypeNode";
}
