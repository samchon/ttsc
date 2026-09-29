/**
 * Inputs for locating the tsconfig/jsconfig that owns an invocation.
 *
 * @evidence contracts/common.md#principled-implementation Optional explicit config, source file and cwd preserve the locator's alternative selection bases; an independent project-root override supports generated configs without changing their selected identity.
 * @evidence contracts/common.md#clear-and-simple-design This input record states selection hints only, leaving discovery and physical identity derivation with the project locator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit overrides are supported caller inputs rather than special cases for temporary fixture paths or known consumers.
 * @evidence contracts/common.md#meaningful-documentation Native member comments identify relative-path/discovery bases and wrapper-root semantics; member spacing and prose/tag separation follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native cwd/file/config/root inputs are kept distinct with documented anchors so the locator can use OS-neutral path APIs; the type requires neither a POSIX root nor manual separator concatenation.
 */
export interface ITtscProjectLocatorOptions {
  /** Working directory for relative paths and upward config discovery. */
  cwd?: string;

  /** Source file used as the starting point for nearest-config discovery. */
  file?: string;

  /** Project root override for generated tsconfig wrappers. */
  projectRoot?: string;

  /** Explicit tsconfig/jsconfig path. */
  tsconfig?: string;
}
