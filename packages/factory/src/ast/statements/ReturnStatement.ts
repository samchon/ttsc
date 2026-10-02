import type { Expression } from "../expressions/Expression";

/**
 * A `return` statement.
 *
 * Built by {@link factory.createReturnStatement}.
 *
 * @evidence contracts/common.md#principled-implementation Optional Expression distinguishes value-returning from bare return syntax; legal function context and return-type compatibility are not checked here.
 * @evidence contracts/common.md#clear-and-simple-design One optional payload represents the varying return syntax without storing control-flow state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Returned expressions are supplied data rather than hardcoded expected results.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies return use and omitted value meaning; member spacing follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ReturnStatement {
  /** Discriminant tag; always `"ReturnStatement"`. */
  kind: "ReturnStatement";

  /** Returned value expression; omitted for a bare return. */
  expression?: Expression;
}
