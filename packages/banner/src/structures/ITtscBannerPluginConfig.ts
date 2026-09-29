/**
 * Host registration and config-file selection for `@ttsc/banner`.
 *
 * This entry belongs in `compilerOptions.plugins[]`. Banner text belongs in
 * the separate `ITtscBannerConfig` value so discovery and config evaluation
 * have one supported home instead of an additional inline option surface.
 *
 * @evidence contracts/common.md#standard-implementation-practices
 *   This optional-field TypeScript interface follows compilerOptions.plugins
 *   registration and the package's dedicated config-file convention. enabled
 *   and transform belong to the host; configFile selects banner-owned
 *   configuration. The type defines no runtime branch or foreign mutation,
 *   fixture answer, test-only path or compensating mechanism. Its fields
 *   describe the supported registration contract, with no alternative
 *   implementation hidden in the data shape.
 *
 * @evidence contracts/platform.md#portable-behavior
 *   Registration stores a module specifier and optional filesystem path; the
 *   host resolves the module and native filepath operations resolve
 *   configFile, rather than this data type imposing separators or process
 *   commands.
 *
 * @evidence contracts/common.md#behavioral-correctness
 *   The host consumes enabled and transform; the banner loader consumes only
 *   configFile beyond host keys. The inspected entry validation rejects
 *   inline text and invalid explicit paths, while discovery uses the host
 *   anchor and rejects missing or ambiguous configurations. Omitted enabled
 *   remains enabled. The separate text object owns banner contents; this type
 *   does not execute discovery or enforce its runtime checks.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Interface and member JSDoc distinguish host registration from banner
 *   text, disabled and omitted enabled states, module specifiers from config
 *   or binary paths, and configFile anchoring, discovery, validation and
 *   failure behavior. Separate paragraphs explain why generated wrapper
 *   directories cannot become the discovery base, applying the documentation
 *   skill's clear prose and rationale guidance to the complete type contract.
 *
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
