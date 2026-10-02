import type { ITtscProjectPluginConfig } from "../ITtscProjectPluginConfig";

/**
 * Internal options shared by the CLI build, single-file emit, and runtime
 * paths.
 *
 * @evidence contracts/common.md#principled-implementation Optional overrides preserve default resolution and distinguish disabled plugins from an explicit replacement list; passthrough tokens retain the native compiler's own option parser authority.
 * @evidence contracts/common.md#clear-and-simple-design The shared record contains cross-path project/process policy once; build and single-file options extend it with their own operation-specific controls.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native binary/env injection is a supported embedding boundary; compiler options remain tokens rather than hardcoded approximations of the entire native schema.
 * @evidence contracts/common.md#meaningful-documentation Native comments explain option ownership, config discovery origins, threading and plugin override states; paragraphs, member and tag spacing follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path inputs and Node environment data stay separate from passthrough argv tokens, enabling OS-neutral spawn/path handling without shell quoting assumptions or platform-specific executable names in this representation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface TtscCommonOptions {
  /**
   * Explicit TypeScript-Go executable.
   *
   * When supplied, ttsc skips package-based tsgo resolution and launches this
   * binary directly.
   */
  binary?: string;

  /** Working directory for config discovery and relative file paths. */
  cwd?: string;

  /** Project root override for generated tsconfig wrappers. */
  projectRoot?: string;

  /**
   * Directory that anchors plugin config-file discovery and relative
   * `configFile` resolution (forwarded to plugin processes as
   * `TTSC_PLUGIN_CONFIG_DIR`). Set by build integrations that compile through a
   * generated tsconfig outside the project; when omitted, plugins anchor at the
   * tsconfig's own directory.
   */
  pluginConfigDir?: string;

  /** Environment variables merged over `process.env` for child processes. */
  env?: NodeJS.ProcessEnv;

  /** Explicit root directory for compiled source-plugin cache artifacts. */
  cacheDir?: string;

  /** Normalize compiler output so diagnostics can be parsed structurally. */
  structuredDiagnostics?: boolean;

  /**
   * Run TypeScript-Go single-threaded — one checker, serial parse/check/emit.
   * Mirrors `tsgo --singleThreaded`. Useful for deterministic debugging and CI
   * repro.
   */
  singleThreaded?: boolean;

  /**
   * Type-checker pool size, mirroring `tsgo --checkers`. `undefined` leaves
   * TypeScript-Go's default; ignored when `singleThreaded` is set.
   */
  checkers?: number;

  /**
   * CLI tokens ttsc did not recognize as its own, forwarded verbatim to the
   * underlying `tsgo` invocation. This is how a tsgo flag ttsc has no first-
   * class option for (`--strict`, `--target es2020`, `--listFiles`, …) still
   * reaches the compiler: ttsc owns its own flags and lets tsgo — which has the
   * complete, arity-aware option parser — handle the rest.
   */
  passthrough?: readonly string[];

  /**
   * Override project plugin loading for this invocation.
   *
   * - `false`: ignore `compilerOptions.plugins` completely.
   * - Array: use these plugin entries instead of the project config entries.
   * - `undefined`: use the project config entries and discover plugins from
   *   direct dependencies.
   */
  plugins?: readonly ITtscProjectPluginConfig[] | false;
}
