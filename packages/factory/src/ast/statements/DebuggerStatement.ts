/**
 * A `debugger` statement.
 *
 * Built by {@link factory.createDebuggerStatement}.
 *
 * @evidence contracts/common.md#principled-implementation A distinct kind records the operand-free debugger statement; it does not execute or configure a debugger.
 * @evidence contracts/common.md#clear-and-simple-design A kind-only interface needs no redundant keyword text or runtime state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Fixed debugger spelling is language syntax, not hidden test-only execution logic.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the debugger statement and constructor; prose/tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface DebuggerStatement {
  /** Discriminant tag; always `"DebuggerStatement"`. */
  kind: "DebuggerStatement";
}
