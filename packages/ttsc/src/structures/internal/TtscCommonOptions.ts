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
   * A nonempty override must be an existing absolute path. It bypasses
   * package-based resolution; the native spawn owns execution failures.
   */
  binary?: string;

  /** Working directory for config discovery and relative file paths. */
  cwd?: string;

  /**
   * Selected project root, resolved from `cwd` independently of config
   * location.
   */
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

  /** Request nonpretty compiler output unless passthrough controls `--pretty`. */
  structuredDiagnostics?: boolean;

  /**
   * Run TypeScript-Go single-threaded — one checker, serial parse/check/emit.
   * Mirrors `tsgo --singleThreaded`. Useful for deterministic debugging and CI
   * repro.
   */
  singleThreaded?: boolean;

  /**
   * Requested checker pool size, mirroring `tsgo --checkers`; `singleThreaded`
   * takes precedence. Check hosts receive this only when they declare support.
   * The source-plugin driver clamps its serial transform Program to one
   * checker; direct TypeScript-Go execution otherwise owns its default and pool
   * policy.
   */
  checkers?: number;

  /**
   * Compiler-option tokens retaining their boundaries and order. Direct tsgo
   * execution forwards them; native hosts receive a JSON compiler-option
   * payload with timing flags omitted because host timing has its own channel.
   * tsgo owns option parsing, including flags without a first-class ttsc option
   * such as `--strict`, `--target es2020` and `--listFiles`. Internal output
   * isolation can append destination overrides after these tokens.
   */
  passthrough?: readonly string[];

  /**
   * Validated visible CLI project assignments at their original positions in
   * passthrough. Only the launcher supplies this metadata; explicit compiler
   * instances retain their resolvedProject authority instead.
   */
  compilerProjectSelections?: readonly {
    passthroughIndex: number;
    value: string;
  }[];

  /**
   * Retained native compiler argument base when project selection redirects
   * the Program to a different root. Absent retains the selected project root.
   * Response frames and relative native options use this base; plugin/rule
   * context and config-relative paths retain their separate project authority.
   */
  compilerArgsCwd?: string;

  /**
   * Override project plugin loading for this invocation.
   *
   * - `false`: disable project plugin loading and dependency discovery.
   * - Array: use these entries instead of config and dependency discovery.
   * - `undefined`: use the project config entries and discover plugins from
   *   direct dependencies.
   */
  plugins?: readonly ITtscProjectPluginConfig[] | false;
}
