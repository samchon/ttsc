import type { ITtscProjectPluginConfig } from "./ITtscProjectPluginConfig";

/**
 * Constructor context for {@link TtscCompiler}.
 *
 * Supplies the selection policy owned by a programmatic ttsc compiler instance.
 * Construction copies the supplied options and environment overrides and
 * captures plugin JSON conversion. Operations cannot replace those inputs.
 *
 * Defaults remain invocation inputs: an omitted working directory uses the
 * current process directory, inherited environment values come from the current
 * process environment, and project/toolchain discovery reads current files.
 * Relative path options are resolved when used. Supply explicit anchors and
 * overrides when calls must keep those selections; construct another instance
 * to change the supplied options.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Optional construction inputs preserve explicit override versus discovery/default behavior; project root, config origin and invocation cwd remain distinct because wrappers and plugin resolution can use different anchors.
 * @evidence contracts/common.md#clear-and-simple-design The context groups one compiler instance's environment and selection policy; operations use this context instead of accepting competing per-call plugin overrides.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Binary, environment and plugin overrides are supported embedding inputs, not fabricated compiler results or foreign-method replacements.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc states override precedence, default cache ownership, plugin selection states and child-environment effects; documented members and prose/tag separation follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Path fields are native filesystem inputs with individually documented cwd/project/config bases; the representation does not require POSIX separators or collapse Windows paths, lexical selection and physical identity into one value. Process environment is supplied as Node's environment map, not shell assignment syntax.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface ITtscCompilerContext {
  /**
   * The working directory for this compiler instance.
   *
   * Used to discover `tsconfig.json`, resolve relative `tsconfig` paths,
   * resolve project source files, resolve plugin packages, and resolve relative
   * cache paths.
   *
   * An omitted value uses `process.cwd()` when the operation resolves its
   * context; construction does not capture that default.
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
   * processes, and for the worker thread of
   * {@link TtscCompiler.transformAsync}.
   *
   * The supplied overrides are copied at construction. Values are merged over
   * the invocation's current `process.env` before ttsc starts TypeScript-Go,
   * native plugin binaries, isolated descriptor evaluators (including the
   * `ttsx` fallback), or the native compiler host used by
   * {@link TtscCompiler.compile}. `transformAsync` runs its whole transform on a
   * worker thread under the same merge, so its in-process work, such as the
   * temporary directories it creates, follows it too. Descriptor output is
   * diagnostic text and is forwarded to stderr so it cannot corrupt
   * compiler/API protocol stdout.
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
