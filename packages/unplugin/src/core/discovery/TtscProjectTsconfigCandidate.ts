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
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The verdict is captured by the walk, not filled from an expected selection.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member comments distinguish spelling from the time-specific regular-file
 *   predicate; documented members and tags are visibly separated.
 */
export interface TtscProjectTsconfigCandidate {
  /** Absolute `tsconfig.json` spelling the walk probed. */
  readonly file: string;

  /** Whether that spelling was proven to be a regular file when probed. */
  readonly fileExists: boolean;
}
