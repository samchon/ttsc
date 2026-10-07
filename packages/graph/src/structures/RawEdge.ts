/**
 * Directed native relationship before viewer display-family grouping.
 *
 * @evidence contracts/common.md#principled-implementation From/to ids and native kind retain relation direction without carrying duplicate node payloads.
 * @evidence contracts/common.md#clear-and-simple-design Three fields suffice for filtering, degree calculation and display grouping.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Endpoints remain producer identities rather than shortened display-name guesses.
 * @evidence contracts/common.md#meaningful-documentation Native member comments distinguish directed ids from the ungrouped relationship kind.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export interface RawEdge {
  /** Native source node identity. */
  from: string;

  /** Native target node identity. */
  to: string;

  /** Producer relationship category before display-family mapping. */
  kind: string;
}
