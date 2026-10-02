/**
 * Host registration and config-file selection for `@ttsc/banner`.
 *
 * This entry belongs in `compilerOptions.plugins[]`. Banner text belongs in
 * the separate `ITtscBannerConfig` value so discovery and config evaluation
 * have one supported home instead of an additional inline option surface.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Optional enabled distinguishes omission from an explicit false host switch;
 *   transform carries the module specifier and configFile carries a separate
 *   filesystem path. Those values belong to different resolution contracts, so
 *   a binary path or inline text is not represented as banner configuration.
 *   String typing does not establish path existence or nonblankness; the loader
 *   validates an explicitly supplied configFile before evaluation.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The type separates two host registration fields from one banner-owned file
 *   selector. Text belongs to the loaded ITtscBannerConfig object, leaving one
 *   evaluation path instead of parallel inline and file configuration policies.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Host switches and configFile represent the supported registration
 *   contract. Banner text has one typed config-file home, preventing a second
 *   inline option shape from bypassing that loader's validation.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Interface and member JSDoc distinguish host registration from banner
 *   text, disabled and omitted enabled states, module specifiers from config
 *   or binary paths, and configFile anchoring, discovery, validation and
 *   failure behavior. Separate paragraphs explain why generated wrapper
 *   directories cannot become the discovery base, applying the documentation
 *   skill's clear prose and rationale guidance to the complete type contract.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The type declares optional host switches and a path string; the factory and native loader own every path operation.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The type is a value shape with no algorithm to analyze.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The type computes nothing, so no equivalent work exists to reuse.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The type acquires no resource and retains nothing.
 */
export interface ITtscBannerPluginConfig {
  /**
   * Set to `false` to retain the entry without running the plugin.
   *
   * Omission leaves the entry enabled. The ttsc host owns this switch; it is
   * not a banner option passed through the standalone config file.
   */
  enabled?: boolean;

  /**
   * Module specifier the host resolves to the plugin factory.
   *
   * Use `@ttsc/banner` to register this package through the transform key.
   * This names the factory module, not the banner config file or Go binary.
   */
  transform?: string;

  /**
   * Explicit banner config path, absolute or relative to the host's plugin
   * config directory. Without that explicit anchor, resolution uses the
   * tsconfig directory, or the invocation directory when no tsconfig is set.
   *
   * Omission searches upward from the same anchor for `banner.config.*`.
   * Missing or ambiguous discovery is an error. An explicit value must be a
   * nonblank string naming a supported config file. Banner-specific inline
   * options such as text are rejected; host-owned registration keys remain
   * permitted.
   *
   * The host anchor matters when the tsconfig is a generated wrapper: its
   * temporary directory must not become the user's config-resolution base.
   */
  configFile?: string;
}
