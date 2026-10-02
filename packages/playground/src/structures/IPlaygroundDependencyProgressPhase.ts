/**
 * Lifecycle phase of dependency installation. `done` can describe one package
 * or the completed install; the shell reports `error` when installation fails.
 *
 * @evidence contracts/common.md#principled-implementation The finite union represents queued, transport, extraction and terminal reporting phases shared by the installer and shell.
 * @evidence contracts/common.md#clear-and-simple-design A named phase union lets event consumers share labels without depending on installer control flow.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Phase constants are supported progress states rather than package-specific cases.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes per-package phases from aggregate completion, with tag separation following the documentation skill.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
export type IPlaygroundDependencyProgressPhase =
  | "queued"
  | "resolve"
  | "download"
  | "extract"
  | "skip"
  | "error"
  | "done";
