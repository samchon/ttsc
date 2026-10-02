/**
 * Plugin-level metadata exposed on `ITtscLintPlugin.meta`.
 *
 * All fields are optional and informational. The lint config's `plugins` map
 * key selects the contributor namespace; metadata does not override that key
 * or the contributor's Go rule registrations.
 *
 * @evidence contracts/common.md#principled-implementation Optional string metadata describes a contributor without asserting executable rule identities or build validation.
 * @evidence contracts/common.md#clear-and-simple-design Package identity, version and advisory namespace share one metadata record separate from required source input.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Metadata does not introduce special-case dispatch or replace the Go registration authority.
 * @evidence contracts/common.md#meaningful-documentation Native comments identify informational fields and distinguish advisory namespace from actual config selection; member spacing and paragraph separation follow documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintPluginMeta is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintPluginMeta is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintPluginMeta is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintPluginMeta is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintPluginMeta {
  /** Plugin package name as published on npm. */
  name?: string;

  /** Plugin package version. */
  version?: string;

  /**
   * Advisory rule namespace prefix (for example, "import"). The lint config's
   * `plugins` key remains authoritative.
   */
  namespace?: string;
}
