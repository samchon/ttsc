/**
 * One exact file predicate consulted by nearest-project discovery.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A lexical absolute filename paired with its observed isFile verdict
 *   represents both accepted and rejected candidates without claiming file bytes.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Two readonly members carry one selection observation together.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The verdict is captured by the walk, not filled from an expected selection.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member comments distinguish spelling from the time-specific regular-file
 *   predicate; documented members and tags are visibly separated.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The file member carries an absolute native spelling; fileExists carries
 *   a proven regular-file result. False can mean a different kind or a failed
 *   stat and does not prove absence; spelling stays separate from authority.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The ancestor walker owns stat/path processing; this pair specifies the
 *   retained result without choosing a search or metadata algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Discovery and downstream routing own observation timing/reproof; the pair
 *   grants no validity for a later native state.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The containing discovery result/caller owns retained candidate/path storage;
 *   this pair specifies no acquired descriptor or independent release operation.
 */
export interface TtscProjectTsconfigCandidate {
  /** Absolute `tsconfig.json` spelling the walk probed. */
  readonly file: string;

  /** Whether that spelling was proven to be a regular file when probed. */
  readonly fileExists: boolean;
}
