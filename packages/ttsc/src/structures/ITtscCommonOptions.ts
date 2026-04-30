import type { ITtscProjectPluginConfig } from "./ITtscProjectPluginConfig";
import type { ITtscResolveOptions } from "./ITtscResolveOptions";

export interface ITtscCommonOptions extends ITtscResolveOptions {
  /** Absolute path to an already-resolved tsgo binary. Skips package resolution. */
  binary?: string;
  /** Working directory passed to the child process. */
  cwd?: string;
  /** Extra environment variables; merged onto `process.env`. */
  env?: NodeJS.ProcessEnv;
  /**
   * Override project plugin loading. `false` disables tsconfig plugins; an
   * array replaces the tsconfig `compilerOptions.plugins` list.
   */
  plugins?: readonly ITtscProjectPluginConfig[] | false;
  /**
   * Override the native rewrite backend. Defaults to the loaded plugin mode.
   *
   * @deprecated Prefer plugin-declared `native.mode`; this override is for
   *   low-level tests and migration probes.
   */
  rewriteMode?: string;
}
