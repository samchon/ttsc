import type { ITtscProjectPluginConfig } from "ttsc";

import type { TtscUnpluginCompilerOptionsJson } from "./TtscUnpluginCompilerOptionsJson";

/**
 * Options accepted by the `@ttsc/unplugin` bundler adapter.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Optional project selection, a JSON compiler overlay and the distinct
 *   undefined/false/array plugin states express the supported caller choices.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Config selection and common source root stay separate from compiler settings and
 *   plugin precedence without exposing internal cache or watcher controls.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   These choices apply to every adapter; false is the documented disable
 *   request rather than a consumer-specific exception.
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc explains relative-path resolution and override precedence.
 *   Separate member paragraphs and spacing follow the documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Project and projectRoot carry native paths: relative spelling is
 *   resolved against process.cwd at delivery. An omitted project requests
 *   discovery; an omitted root uses the config directory. Compiler settings retain their compiler-owned path semantics;
 *   this type imposes no separator or filesystem case policy.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscUnpluginOptions only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscUnpluginOptions only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscUnpluginOptions only declares a shape; it has no handle or retained
 *   state at runtime.
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
   * Common source root for a config that includes sibling workspace packages.
   *
   * Relative paths resolve from `process.cwd()`. Omission uses the selected
   * config's directory. Plugin config discovery remains anchored at that
   * config.
   */
  projectRoot?: string;

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
