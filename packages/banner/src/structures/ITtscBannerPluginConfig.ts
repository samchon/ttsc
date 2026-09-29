/**
 * Host registration and config-file selection for `@ttsc/banner`.
 *
 * This entry belongs in `compilerOptions.plugins[]`. Banner text belongs in
 * the separate `ITtscBannerConfig` value so discovery and config evaluation
 * have one supported home instead of an additional inline option surface.
 *
 * @evidence contracts/common.md#no-implementation-shortcuts The fields describe host registration and the banner-owned configFile option accepted by the factory; the interface adds no consumer exception, monkey patch, test-only branch or workaround.
 * @evidence contracts/common.md#portable-behavior Registration stores a module specifier and optional filesystem path; the host resolves the module and native filepath operations resolve configFile, rather than this data type imposing separators or process commands.
 * @evidence contracts/common.md#meaningful-documentation The comment explains placement and the separation from banner text, with the reason in its own paragraph and native JSDoc syntax following the documentation skill's prose guidance.
 */
export interface ITtscBannerPluginConfig {
  /**
   * Set to `false` to retain the entry without running the plugin.
   *
   * Omission leaves the entry enabled. The ttsc host owns this switch; it is
   * not a banner option passed through the standalone config file.
   *
   * @evidence contracts/common.md#no-implementation-shortcuts This boolean represents the host's supported enable switch; it contains no fixture logic, foreign mutation, test-only execution or alternate repair path.
   * @evidence contracts/common.md#portable-behavior This host-owned boolean has no path, line-ending or process representation that varies by operating system.
   * @evidence contracts/common.md#meaningful-documentation The comment explains false and omitted values and identifies the consuming host, using distinct paragraphs to separate behavior from ownership.
   */
  enabled?: boolean;

  /**
   * Module specifier the host resolves to the plugin factory.
   *
   * Use `@ttsc/banner` to register this package through the transform key.
   * This names the factory module, not the banner config file or Go binary.
   *
   * @evidence contracts/common.md#no-implementation-shortcuts The package specifier identifies the real host-loadable factory; the member performs no fixture matching, foreign replacement, test-only execution or compensating behavior.
   * @evidence contracts/common.md#portable-behavior The value is a module specifier interpreted by the host's module resolver, rather than a filesystem path assembled with OS-specific separators.
   * @evidence contracts/common.md#meaningful-documentation The comment explains the value's consumer and distinguishes it from config and binary paths, with the usage example in a separate paragraph under the documentation skill's clear-prose guidance.
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
   *
   * @evidence contracts/common.md#no-implementation-shortcuts The path selects the dedicated supported config surface; discovery is driven by actual config candidates rather than fixture names, with no foreign mutation, test-only branch or layered workaround in this member.
   * @evidence contracts/common.md#portable-behavior The factory uses node:path resolution and the native loader uses filepath absolute/join operations from the same host anchor; the declaration stores a path without imposing separators or shell syntax.
   * @evidence contracts/common.md#meaningful-documentation The comment states anchoring, omission, invalid and missing input behavior, and why wrapper locations must not select the base, separating those ideas into JSDoc paragraphs.
   */
  configFile?: string;
}
