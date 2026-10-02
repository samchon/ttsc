/**
 * One contributor's resolved Go source plus its target sub-package name.
 *
 * @evidence contracts/common.md#principled-implementation The name fixes the contributor's import suffix and the absolute source identifies the directory hashed and copied into the host module.
 * @evidence contracts/common.md#clear-and-simple-design Two fields carry the already-resolved contribution, leaving descriptor validation and scratch materialization to their owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The name is caller-declared contribution identity, not a fixture-specific package insertion.
 * @evidence contracts/common.md#meaningful-documentation Members state the contrib target layout and absolute source-path requirement with separate native comments.
 * @evidence contracts/portability.md#os-neutral-implementation Source carries the caller's resolved absolute native directory. Name is used both as a native contrib-directory component and a Go import suffix; this type does not validate materialization eligibility or pin physical identity, which remain with admission/copy owners.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface ITtscBuildContributor {
  /** Sub-package suffix: scratch lands at `<host>/contrib/<name>/`. */
  name: string;

  /** Absolute path to the contributor's source directory. */
  source: string;
}
