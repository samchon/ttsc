import type { ITtscProjectPluginConfig } from "../ITtscProjectPluginConfig";

/** Internal options shared by the CLI build, transform, and runtime paths. */
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
  /** Environment variables merged over `process.env` for child processes. */
  env?: NodeJS.ProcessEnv;
  /**
   * Override project plugin loading for this invocation.
   *
   * - `false`: ignore `compilerOptions.plugins` completely.
   * - array: use these plugin entries instead of the project config entries.
   * - `undefined`: use the project config entries as written.
   */
  plugins?: readonly ITtscProjectPluginConfig[] | false;
}
