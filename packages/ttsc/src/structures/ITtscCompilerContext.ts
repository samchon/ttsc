import type { ITtscProjectPluginConfig } from "./ITtscProjectPluginConfig";

/**
 * Constructor context for {@link TtscCompiler}.
 *
 * Represents the project environment owned by a programmatic ttsc compiler
 * instance. The context is fixed when the class is constructed: compile,
 * prepare, and clean operations all use the same working directory, project
 * config, native toolchain, environment, cache root, and plugin list.
 *
 * Keeping this context immutable prevents one `TtscCompiler` object from
 * silently compiling different projects across calls. Create another compiler
 * instance when any of these fields must change.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface ITtscCompilerContext {
  /**
   * The working directory for this compiler instance.
   *
   * Used to discover `tsconfig.json`, resolve relative `tsconfig` paths,
   * resolve project source files, resolve plugin packages, and resolve relative
   * cache paths.
   *
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * The project configuration file for this compiler instance.
   *
   * Relative paths are resolved from {@link ITtscCompilerContext.cwd}. When this
   * field is omitted, ttsc discovers the nearest owning `tsconfig.json` or
   * `jsconfig.json` from the working directory.
   */
  tsconfig?: string;

  /**
   * Explicit TypeScript-Go executable for controlled embedding.
   *
   * Normal consumers should leave this unset. ttsc resolves the installed or
   * bundled toolchain needed for each compile path. This field is intended for
   * tests, pinned toolchains, and embedding environments that need plugin or
   * CLI-compatible paths to use a specific TypeScript-Go binary.
   *
   * The no-plugin in-memory API path is hosted by ttsc's native compiler host
   * so it can return structured diagnostics and output. Plugin-backed paths
   * pass this binary through to the TypeScript-Go execution layer.
   */
  binary?: string;

  /**
   * Additional environment variables for child compiler processes.
   *
   * Values are merged over `process.env` before ttsc starts TypeScript-Go,
   * native plugin binaries, or the native compiler host used by
   * {@link TtscCompiler.compile}.
   */
  env?: NodeJS.ProcessEnv;

  /**
   * Root directory for compiled ttsc artifacts.
   *
   * Relative paths are resolved from {@link ITtscCompilerContext.cwd}. When
   * omitted, ttsc uses its normal cache location: `TTSC_CACHE_DIR` when
   * present, otherwise `node_modules/.ttsc` or `.ttsc` under the project root.
   *
   * The same cache stores source-plugin binaries and the lazily built native
   * compiler host used for in-memory API compilation.
   */
  cacheDir?: string;

  /**
   * Plugin entries for this compiler instance.
   *
   * - `undefined`: read `compilerOptions.plugins` from the project config.
   * - `false`: ignore project plugins for this compiler instance.
   * - array: use these plugin entries instead of the project config entries.
   *
   * Plugin entries are resolved once per operation from this instance context.
   * Per-call plugin overrides are intentionally not part of the public API.
   */
  plugins?: readonly ITtscProjectPluginConfig[] | false;
}
