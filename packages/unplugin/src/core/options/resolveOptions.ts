import type { ResolvedTtscUnpluginOptions } from "./ResolvedTtscUnpluginOptions";
import type { TtscUnpluginOptions } from "./TtscUnpluginOptions";

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
