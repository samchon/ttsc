import type { ITtscProjectPluginConfig } from "./ITtscProjectPluginConfig";

/**
 * Project context passed to plugin descriptor factories.
 *
 * Plugin packages may export a static {@link ITtscPlugin} descriptor when the
 * descriptor never depends on the consuming project. Export a factory when the
 * descriptor needs to inspect the original plugin config, the resolved tsconfig
 * path, the project root, or the descriptor's own location on disk.
 *
 * The factory runs in an isolated supported JavaScript runtime while ttsc loads
 * `compilerOptions.plugins`. It should only create the descriptor. Heavy
 * validation and TypeScript-Go work belong in the selected Go source plugin.
 *
 * @evidence contracts/common.md#principled-implementation Separate invocation, project, configuration and descriptor locations preserve their different resolution bases; the generic plugin field keeps the factory's own config type without guessing its shape.
 * @evidence contracts/common.md#clear-and-simple-design One factory input collects already-resolved context and the original configuration so descriptors need neither reparse CLI arguments nor infer their own load mode.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit filename/dirname fields are the supported descriptor boundary for both module modes; they avoid substituting globals or consumer-specific path repairs.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains each path's origin, generated-wrapper overrides and the descriptor factory's limited responsibility; member spacing, paragraphs and separation before tags follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Explicit native descriptor and project path anchors support OS-neutral path resolution without deriving them from URL text, POSIX separator splitting or CommonJS-only globals. Invocation cwd, project root and config origin keep their separate identities across generated wrappers.
 */
export interface ITtscPluginFactoryContext<T = ITtscProjectPluginConfig> {
  /**
   * Absolute ttsc native helper binary selected for this invocation.
   *
   * This is the package's own native helper, not the plugin source and not the
   * JavaScript launcher. Most plugins do not need it; it is provided for
   * advanced factories that need to derive behavior from the active ttsc native
   * host.
   */
  binary: string;

  /**
   * Current working directory requested by the caller.
   *
   * This is the cwd used for project discovery and relative command-line
   * inputs. It can differ from {@link ITtscPluginFactoryContext.projectRoot}
   * when the caller points at a tsconfig in another directory.
   */
  cwd: string;

  /**
   * Absolute path to the directory holding the resolved plugin descriptor entry
   * — the directory of {@link ITtscPluginFactoryContext.filename}.
   *
   * This is the load-mode-independent replacement for the CommonJS `__dirname`.
   * A descriptor compiled to CommonJS and loaded through `require` keeps
   * `__dirname`, but a `.ts`-source or ESM descriptor (loaded through ttsx or
   * as a native module) runs without it, so a `source` derived from `__dirname`
   * silently mis-resolves. Resolve package-relative paths from `dirname`
   * instead: it is always the descriptor file's own directory, regardless of
   * how ttsc loaded it.
   */
  dirname: string;

  /**
   * Absolute path to the resolved plugin descriptor entry module itself — the
   * file ttsc loaded for this entry's `transform` specifier.
   *
   * This is the load-mode-independent replacement for the CommonJS
   * `__filename`, available even when the descriptor runs as ESM or `.ts`
   * source where the `__filename` global is undefined.
   * {@link ITtscPluginFactoryContext.dirname} is its containing directory.
   */
  filename: string;

  /**
   * Original `compilerOptions.plugins[]` entry that loaded this plugin.
   *
   * Ttsc reserves `transform` and `enabled`. Every other property is
   * plugin-owned config and is later serialized unchanged into the native
   * plugin manifest.
   */
  plugin: T;

  /**
   * Caller-declared anchor for plugin config-file discovery and relative
   * `configFile` resolution.
   *
   * Absent for ordinary invocations, where a factory anchors config discovery
   * at the {@link ITtscPluginFactoryContext.tsconfig} directory. Present when
   * the embedder compiles through a generated tsconfig outside the project (the
   * bundler adapters' alias overlay): it names the real project directory, and
   * a factory that discovers its own config file should anchor there instead of
   * the generated tsconfig's temp-dir ancestry. Mirrors the
   * `TTSC_PLUGIN_CONFIG_DIR` environment variable ttsc sets for native plugin
   * processes.
   */
  pluginConfigDir?: string;

  /**
   * Project root used as the native plugin working directory and package
   * discovery base.
   *
   * By default this is the directory containing the resolved tsconfig/jsconfig.
   * Callers may override it when a wrapper config lives outside the project.
   * Relative `source` paths returned by a plugin descriptor resolve from this
   * directory.
   */
  projectRoot: string;

  /**
   * Absolute path to the resolved tsconfig/jsconfig.
   *
   * Factories can use this to select descriptor variants for monorepos or
   * multiple project configs without reparsing command-line arguments.
   */
  tsconfig: string;
}
