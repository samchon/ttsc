/**
 * One contributor's resolved Go source plus its target sub-package name.
 *
 * @evidence contracts/common.md#principled-implementation The name fixes the contributor's import suffix and the absolute source identifies the directory hashed and copied into the host module.
 * @evidence contracts/common.md#clear-and-simple-design Two fields carry the already-resolved contribution, leaving descriptor validation and scratch materialization to their owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The name is caller-declared contribution identity, not a fixture-specific package insertion.
 * @evidence contracts/common.md#meaningful-documentation Members state the contrib target layout and absolute source-path requirement with separate native comments.
 * @evidence contracts/portability.md#os-neutral-implementation Source is a native absolute directory resolved by the loader; name is the logical sub-package suffix, so filesystem identity and Go import spelling remain distinct.
 */
export interface ITtscBuildContributor {
  /** Sub-package suffix: scratch lands at `<host>/contrib/<name>/`. */
  name: string;

  /** Absolute path to the contributor's source directory. */
  source: string;
}
