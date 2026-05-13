import type { ITtscProjectPluginConfig } from "../ITtscProjectPluginConfig";

/**
 * Internal options shared by the CLI build, single-file emit, and runtime
 * paths.
 */
export interface TtscCommonOptions {
  /**
   * Explicit TypeScript-Go executable.
   *
   * When supplied, ttsc skips package-based tsgo resolution and shells out to
   * this binary directly.
   */
  binary?: string;
  /** Working directory for config discovery and relative file paths. */
  cwd?: string;
  /** Project root override for generated tsconfig wrappers. */
  projectRoot?: string;
  /** Environment variables merged over `process.env` for child processes. */
  env?: NodeJS.ProcessEnv;
  /** Explicit root directory for compiled source-plugin cache artifacts. */
  cacheDir?: string;
  /** Normalize compiler output so diagnostics can be parsed structurally. */
  structuredDiagnostics?: boolean;
  /**
   * Override project plugin loading for this invocation.
   *
   * - `false`: ignore `compilerOptions.plugins` completely.
   * - Array: use these plugin entries instead of the project config entries.
   * - `undefined`: use the project config entries as written.
   */
  plugins?: readonly ITtscProjectPluginConfig[] | false;
}
