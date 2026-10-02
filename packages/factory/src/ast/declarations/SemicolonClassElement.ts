/**
 * A stray `;` in a class body.
 *
 * Built by {@link factory.createSemicolonClassElement}.
 *
 * @evidence contracts/common.md#principled-implementation A dedicated kind preserves a real semicolon class member rather than an omitted or missing member.
 * @evidence contracts/common.md#clear-and-simple-design The kind alone suffices because this syntax form has no varying payload.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Fixed semicolon output is the language form's contract, not a fixture-padding workaround.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the class-body semicolon and constructor; prose/tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface SemicolonClassElement {
  /** Discriminant tag; always `"SemicolonClassElement"`. */
  kind: "SemicolonClassElement";
}
