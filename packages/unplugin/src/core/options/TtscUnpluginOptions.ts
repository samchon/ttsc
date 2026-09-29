import type { ITtscProjectPluginConfig } from "ttsc";

import type { TtscUnpluginCompilerOptionsJson } from "./TtscUnpluginCompilerOptionsJson";

/**
 * Options accepted by the `@ttsc/unplugin` bundler adapter.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Optional project selection, a JSON compiler overlay and the distinct
 *   undefined/false/array plugin states express the supported caller choices.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The three members separate project selection from compiler settings and
 *   plugin precedence without exposing internal cache or watcher controls.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   These choices apply to every adapter; false is the documented disable
 *   request rather than a consumer-specific exception.
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc explains relative-path resolution and override precedence.
 *   Separate member paragraphs and spacing follow the documentation guidance.
 */
export interface TtscUnpluginOptions {
  /**
   * Project config used by the bundler adapter.
   *
   * Relative paths resolve from `process.cwd()`. When omitted, the nearest
   * `tsconfig.json` is discovered from the transformed file.
   */
  project?: string;

  /**
   * Compiler options overlaid on top of the selected project config.
   *
   * This can include `plugins`; `plugins` passed at the top level still wins as
   * the explicit plugin override.
   */
  compilerOptions?: TtscUnpluginCompilerOptionsJson;

  /**
   * `ttsc` plugin entries.
   *
   * `undefined` reads project plugins from `compilerOptions.plugins` and
   * directly installed package markers, `false` disables project plugins, and
   * an array overrides the project plugin list.
   */
  plugins?: readonly ITtscProjectPluginConfig[] | false;
}
