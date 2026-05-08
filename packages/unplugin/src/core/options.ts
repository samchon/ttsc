import type { ITtscProjectPluginConfig } from "ttsc";

export type TtscUnpluginCompilerOptionsJson = Record<string, unknown>;

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

export interface ResolvedTtscUnpluginOptions {
  compilerOptions: TtscUnpluginCompilerOptionsJson;
  plugins?: readonly ITtscProjectPluginConfig[] | false;
  project?: string;
}

const defaultOptions: ResolvedTtscUnpluginOptions = {
  compilerOptions: {},
  plugins: undefined,
  project: undefined,
};

export function resolveOptions(
  options: TtscUnpluginOptions = {},
): ResolvedTtscUnpluginOptions {
  return {
    compilerOptions: { ...(options.compilerOptions ?? {}) },
    plugins: "plugins" in options ? options.plugins : defaultOptions.plugins,
    project: options.project ?? defaultOptions.project,
  };
}
