import type { ITtscProjectPluginConfig } from "./ITtscProjectPluginConfig";

/**
 * Project context passed to `createTtscPlugin()` factories.
 *
 * Plugin packages may export a static {@link ITtscPlugin} descriptor when the
 * descriptor never depends on the consuming project. Export a
 * `createTtscPlugin(context)` factory instead when the descriptor needs to
 * inspect the original plugin config, the resolved tsconfig path, or the
 * project root.
 *
 * The factory runs in Node.js while ttsc is loading `compilerOptions.plugins`.
 * It should only create the descriptor. Heavy validation and TypeScript-Go
 * work belong in the Go sidecar selected by {@link ITtscPlugin.source}.
 */
export interface ITtscPluginFactoryContext<T = ITtscProjectPluginConfig> {
  /**
   * Absolute ttsc native helper binary selected for this invocation.
   *
   * This is the package's own native helper, not the plugin sidecar and not the
   * JavaScript launcher. Most plugins do not need it; it is provided for
   * advanced factories that need to derive behavior from the active ttsc
   * native host.
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
   * Original `compilerOptions.plugins[]` entry that loaded this plugin.
   *
   * ttsc reserves `transform` and `enabled`. Every other property is
   * plugin-owned config and is later serialized unchanged into the native
   * sidecar manifest.
   */
  plugin: T;

  /**
   * Directory containing the resolved tsconfig/jsconfig.
   *
   * Relative plugin module specifiers and plugin source paths are resolved from
   * this directory, matching TypeScript plugin config behavior.
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
