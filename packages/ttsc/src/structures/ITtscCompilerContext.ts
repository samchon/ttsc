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
   * Project root override for generated config wrappers.
   *
   * Most callers should leave this unset so the project root is the directory
   * containing {@link ITtscCompilerContext.tsconfig}. Embedders that synthesize
   * a temporary config extending a real project config can set this to keep
   * plugin resolution, cache paths, and native plugin `--cwd` anchored to the
   * real project.
   */
  projectRoot?: string;

  /**
   * Directory that anchors plugin config-file discovery and relative
   * `configFile` resolution.
   *
   * Leave this unset so plugins anchor at the directory of the resolved
   * {@link ITtscCompilerContext.tsconfig} as usual. Embedders that compile
   * through a generated tsconfig outside the project (the bundler adapters'
   * alias overlay, for example) set it to the real project directory; ttsc
   * forwards the value to every plugin process as `TTSC_PLUGIN_CONFIG_DIR`, so
   * `banner.config.*` / `strip.config.*` / `lint.config.*` discovery walks the
   * project instead of the generated tsconfig's temp-dir ancestry. Relative
   * paths are resolved from {@link ITtscCompilerContext.cwd}.
   */
  pluginConfigDir?: string;

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
   * Additional environment variables for child compiler and plugin-descriptor
   * processes, and for the worker thread of {@link TtscCompiler.transformAsync}.
   *
   * Values are merged over `process.env` before ttsc starts TypeScript-Go,
   * native plugin binaries, isolated descriptor evaluators (including the
   * `ttsx` fallback), or the native compiler host used by
   * {@link TtscCompiler.compile}. `transformAsync` runs its whole transform on a
   * worker thread under the same merge, so its in-process work, such as the
   * temporary directories it creates, follows it too (samchon/ttsc#1488).
   * Descriptor output is diagnostic text and is forwarded to stderr so it cannot
   * corrupt compiler/API protocol stdout.
   */
  env?: NodeJS.ProcessEnv;

  /**
   * Root directory for compiled ttsc artifacts.
   *
   * Relative paths are resolved from {@link ITtscCompilerContext.cwd}. When
   * omitted, ttsc uses its normal cache location: `TTSC_CACHE_DIR` when
   * present, otherwise the project-local cache at the workspace root's
   * `node_modules/.cache/ttsc`. ttsc keeps no machine-global cache.
   *
   * The same cache stores source-plugin binaries and the lazily built native
   * compiler host used for in-memory API compilation.
   */
  cacheDir?: string;

  /**
   * Plugin entries for this compiler instance.
   *
   * - `undefined`: read project plugins from `compilerOptions.plugins` and
   *   directly installed package markers.
   * - `false`: ignore project config plugins and package markers for this
   *   compiler instance.
   * - Array: use these plugin entries instead of project config entries and
   *   package markers.
   *
   * Plugin entries are resolved once per operation from this instance context.
   * Per-call plugin overrides are intentionally not part of the public API.
   */
  plugins?: readonly ITtscProjectPluginConfig[] | false;
}
