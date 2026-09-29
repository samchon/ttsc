/**
 * Lifecycle phase of dependency installation. `done` can describe one package
 * or the completed install; the shell reports `error` when installation fails.
 *
 * @evidence contracts/common.md#principled-implementation The finite union represents queued, transport, extraction and terminal reporting phases shared by the installer and shell.
 * @evidence contracts/common.md#clear-and-simple-design A named phase union lets event consumers share labels without depending on installer control flow.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Phase constants are supported progress states rather than package-specific cases.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes per-package phases from aggregate completion, with tag separation following the documentation skill.
 */
export type IPlaygroundDependencyProgressPhase =
  | "queued"
  | "resolve"
  | "download"
  | "extract"
  | "skip"
  | "error"
  | "done";
