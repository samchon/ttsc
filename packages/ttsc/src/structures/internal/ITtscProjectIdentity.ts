/**
 * Separate lexical and physical identities for one selected project.
 *
 * @evidence contracts/common.md#principled-implementation Invocation and logical spellings remain separate from realpath-resolved Program identities because symlink selection and physical compiler ownership can differ; explicit overrides remain distinguishable from defaults.
 * @evidence contracts/common.md#clear-and-simple-design Named identity fields make each path's role available to plugin contexts without overloading one project root for selection, loading and caller overrides.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Lexical paths are not discarded and later recreated with platform guesses; caller-declared origins stay explicit rather than being inferred from generated wrapper locations.
 * @evidence contracts/common.md#meaningful-documentation Native comments explain canonicalization and the origin of each identity; blank member lines and prose/tag separation follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral consumers can preserve caller lexical selection and follow physical realpaths independently, including symlink/junction aliases; the type imposes neither slash splitting nor blanket lowercasing of filesystem identities.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface ITtscProjectIdentity {
  /** Caller working directory before filesystem canonicalization. */
  invocationCwd: string;

  /** Caller-selected config spelling before filesystem canonicalization. */
  logicalConfigPath: string;

  /** Directory containing the caller-selected config spelling. */
  logicalProjectRoot: string;

  /** Realpath-resolved config used to load the TypeScript Program. */
  physicalConfigPath: string;

  /** Realpath-resolved root supplied to the TypeScript Program host. */
  physicalProjectRoot: string;

  /** Caller-declared project-root override, when present. */
  explicitProjectRoot?: string;

  /** Caller-declared plugin-config discovery origin, when present. */
  pluginConfigOrigin?: string;
}
