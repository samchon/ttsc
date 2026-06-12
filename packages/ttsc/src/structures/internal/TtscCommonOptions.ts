import type { ITtscProjectPluginConfig } from "../ITtscProjectPluginConfig";
import type { ITtscLoadedNativePlugin } from "./ITtscLoadedNativePlugin";

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
   * - `undefined`: use the project config entries as written.
   */
  plugins?: readonly ITtscProjectPluginConfig[] | false;
  /**
   * Pre-resolved native plugins for an internal build replay.
   *
   * `ttsx` uses this when runtime hooks need to build generated sources from
   * the entry project after the parent process has already resolved and built
   * the same plugin sources. Supplying the loaded descriptors keeps the replay
   * on the same binaries instead of rebuilding source plugins from a temporary
   * tsconfig wrapper.
   */
  nativePlugins?: readonly ITtscLoadedNativePlugin[];
}
