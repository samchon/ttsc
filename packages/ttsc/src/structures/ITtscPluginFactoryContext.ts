import type { ITtscProjectPluginConfig } from "./ITtscProjectPluginConfig";

/**
 * Project context passed to plugin descriptor factories.
 *
 * Plugin packages may export a static {@link ITtscPlugin} descriptor when the
 * descriptor never depends on the consuming project. Export a factory when the
 * descriptor needs to inspect the original plugin config, the resolved tsconfig
 * path, the project root, or the descriptor's own location on disk.
 *
 * The factory runs in Node.js while ttsc is loading `compilerOptions.plugins`.
 * It should only create the descriptor. Heavy validation and TypeScript-Go work
 * belong in the Go source plugin selected by {@link ITtscPlugin.source}.
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
