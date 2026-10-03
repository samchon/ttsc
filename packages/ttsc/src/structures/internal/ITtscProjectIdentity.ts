/**
 * Separate lexical and physical identities for one selected project.
 *
 * The resolver attempts realpath for the physical fields. If that operation
 * fails, it retains the selected absolute spelling; the field names alone do
 * not certify filesystem identity.
 *
 * @evidence contracts/common.md#principled-implementation Invocation and logical spellings remain separate from the resolver's physical-path selections because symlink selection and compiler ownership can differ; realpath failure preserves the selected absolute spelling rather than certifying it, and explicit overrides remain distinguishable from defaults.
 * @evidence contracts/common.md#clear-and-simple-design Named identity fields make each path's role available to plugin contexts without overloading one project root for selection, loading and caller overrides.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Lexical paths are not discarded and later recreated with platform guesses; caller-declared origins stay explicit rather than being inferred from generated wrapper locations.
 * @evidence contracts/common.md#meaningful-documentation Native comments explain canonicalization and the origin of each identity; blank member lines and prose/tag separation follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native lexical selections and physical-path results retain their separate roles, including the realpath-failure fallback; the type requires neither manual separator splitting nor blanket lowercasing, and physical equality remains a filesystem owner's responsibility.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface ITtscProjectIdentity {
  /** Absolute invocation working directory, without realpath resolution. */
  invocationCwd: string;

  /** Selected absolute config spelling, before realpath resolution. */
  logicalConfigPath: string;

  /** Directory containing the caller-selected config spelling. */
  logicalProjectRoot: string;

  /** Config path after attempted realpath; selected spelling on failure. */
  physicalConfigPath: string;

  /** Selected root after attempted realpath; selected spelling on failure. */
  physicalProjectRoot: string;

  /** Caller project-root override resolved from invocation cwd, when present. */
  explicitProjectRoot?: string;

  /** Caller-declared plugin-config discovery origin, when present. */
  pluginConfigOrigin?: string;
}
