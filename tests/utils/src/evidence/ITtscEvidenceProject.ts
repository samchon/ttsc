/**
 * A materialized fixture project and the handle that disposes it.
 *
 * The directory is a real temporary project with its own `node_modules`, so a
 * case that forgets to clean up leaves a linked copy of the workspace behind.
 * Cases request disposal in `finally`; unknown process closure retains the
 * inputs and reports a blocking failure instead of removing active inputs.
 *
 * @evidence contracts/common.md#principled-implementation The handle identifies the actual project and containing workspace; cleanup refuses removal when the process owner recorded unknown descendants.
 * @evidence contracts/common.md#clear-and-simple-design Two readonly absolute paths and one synchronous cleanup operation carry fixture ownership without duplicating preparation or process policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A cleanup call requests release rather than declaring process closure; unknown input retention remains an observable error with its original cause.
 * @evidence contracts/common.md#meaningful-documentation Explains ancestor population inputs, repeated cleanup after known release and the failure that preserves unresolved-reader inputs.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Both readonly paths name native absolute directories; the cleanup signature requests native removal only after the process owner admits it.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscEvidenceProject defines a representation; it chooses no processing algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscEvidenceProject defines no computation-sharing or invalidation policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscEvidenceProject carries data or signatures; acquisition and release remain with the implementing operation.
 */
export interface ITtscEvidenceProject {
  /** Absolute path of the throwaway project root. */
  readonly directory: string;

  /**
   * Absolute path of the directory the project sits inside.
   *
   * This is what a population's `root` can ascend into, and what a case writes
   * a shared document set to. Disposing the fixture disposes it too.
   */
  readonly workspace: string;

  /**
   * Removes the fixture, tolerating a directory the OS has not released yet.
   *
   * Safe to call more than once after known process release. An unknown
   * descendant lifetime refuses removal and preserves the original cause.
   *
   * @evidence contracts/common.md#principled-implementation The signature requests disposal through the project's actual allocation owner, whose admission check refuses unknown readers.
   * @evidence contracts/common.md#clear-and-simple-design One synchronous void method keeps allocation and process policy outside the data handle.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Calling cleanup is not a descendant join or unconditional release certificate.
   * @evidence contracts/common.md#meaningful-documentation The method paragraphs state repeated-call tolerance, transient removal retries and refusal with the original unknown-reader cause.
   * @evidence contracts/portability.md#os-neutral-implementation The implementation uses Node native recursive removal with finite retry options; retained reader inputs remain untouched.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This ownership signature does not itself choose a removal algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Cleanup is an effectful release request and cannot be cached as proof of reader completion.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The project owner releases its exact workspace only after admission. Failed removal or unknown reader ownership stays observable instead of claiming disposal.
   */
  cleanup(): void;
}
