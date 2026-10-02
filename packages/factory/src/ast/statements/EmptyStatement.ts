/**
 * An empty statement (a lone `;`).
 *
 * Built by {@link factory.createEmptyStatement}.
 *
 * @evidence contracts/common.md#principled-implementation A distinct kind preserves a real semicolon statement, unlike a non-emitted placeholder that contributes no syntax.
 * @evidence contracts/common.md#clear-and-simple-design A kind-only form needs no text field because its syntax is fixed.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The semicolon defines the published statement form rather than a fixture workaround.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explicitly identifies the lone semicolon and constructor; prose/tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface EmptyStatement {
  /** Discriminant tag; always `"EmptyStatement"`. */
  kind: "EmptyStatement";
}
