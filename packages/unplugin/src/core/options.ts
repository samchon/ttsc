import type { ITtscProjectPluginConfig } from "ttsc";

/** Raw compiler-options overlay supplied by the caller as a plain JSON value. */
export type TtscUnpluginCompilerOptionsJson = Record<string, unknown>;

/** Options accepted by the `@ttsc/unplugin` bundler adapter. */
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

/**
 * Fully-resolved plugin options with all defaults applied.
 *
 * Produced by {@link resolveOptions}; consumed internally by the transform
 * pipeline. Every field is present and normalised — callers should not
 * construct this type directly.
 */
export interface ResolvedTtscUnpluginOptions {
  /** Compiler-options overlay applied on top of the discovered tsconfig. */
  compilerOptions: TtscUnpluginCompilerOptionsJson;
  /**
   * Resolved plugin list; mirrors the semantics of
   * {@link TtscUnpluginOptions.plugins}.
   */
  plugins?: readonly ITtscProjectPluginConfig[] | false;
  /** Resolved path to the project tsconfig, or `undefined` to auto-discover. */
  project?: string;
}

const defaultOptions: ResolvedTtscUnpluginOptions = {
  compilerOptions: {},
  plugins: undefined,
  project: undefined,
};

/**
 * Normalise raw user-supplied options into {@link ResolvedTtscUnpluginOptions}.
 *
 * Merges provided values with defaults. The `plugins` field uses an explicit
 * `"plugins" in options` presence check rather than a falsy guard so that
 * `plugins: false` (disable all plugins) is preserved as-is.
 */
export function resolveOptions(
  options: TtscUnpluginOptions = {},
): ResolvedTtscUnpluginOptions {
  return {
    compilerOptions: { ...(options.compilerOptions ?? {}) },
    plugins: "plugins" in options ? options.plugins : defaultOptions.plugins,
    project: options.project ?? defaultOptions.project,
  };
}
