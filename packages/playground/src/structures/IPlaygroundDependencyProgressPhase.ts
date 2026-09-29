/**
 * Lifecycle phase of a single dependency install reported via the progress
 * callback.
 *
 * @evidence contracts/common.md#principled-implementation The finite union represents the installer's queued, transport, extraction and terminal reporting phases.
 * @evidence contracts/common.md#clear-and-simple-design A named phase union lets event consumers share labels without depending on installer control flow.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Phase constants are supported progress states rather than package-specific cases.
 * @evidence contracts/common.md#meaningful-documentation Native prose defines the callback's phase domain, with tag separation following the documentation skill.
 */
export type IPlaygroundDependencyProgressPhase =
  | "queued"
  | "resolve"
  | "download"
  | "extract"
  | "skip"
  | "error"
  | "done";
