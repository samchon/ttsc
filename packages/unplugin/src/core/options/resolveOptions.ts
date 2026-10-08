import type { ResolvedTtscUnpluginOptions } from "./ResolvedTtscUnpluginOptions";
import type { TtscUnpluginOptions } from "./TtscUnpluginOptions";

const defaultOptions: ResolvedTtscUnpluginOptions = {
  compilerOptions: {},
  plugins: undefined,
  project: undefined,
  projectRoot: undefined,
};

/**
 * Normalise raw user-supplied options into {@link ResolvedTtscUnpluginOptions}.
 *
 * Merges provided values with defaults. The `plugins` field uses an explicit
 * `"plugins" in options` presence check rather than a falsy guard so that
 * `plugins: false` (disable all plugins) is preserved as-is.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Nullish defaults normalize the overlay and project; a presence check
 *   preserves explicit false and undefined plugin overrides. Object spread
 *   detaches top-level compiler keys while nested values retain caller identity.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One returned record owns option normalization; transform code receives
 *   the same four choices without a second defaults layer. The optional root
 *   retains its spelling until delivery resolves it against process.cwd.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Empty defaults implement omission semantics, and the false branch implements
 *   the public disable request rather than a consumer-specific exception.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc identifies the normalized result and explains the non-falsy plugin
 *   check. Separate prose and tags follow the documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One shallow object spread copies the supplied compiler-option keys in
 *   linear time and space. Nested option values are not traversed; this copy
 *   detaches the returned top-level overlay from later caller assignments.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function resolveOptions(
  options: TtscUnpluginOptions = {},
): ResolvedTtscUnpluginOptions {
  return {
    compilerOptions: { ...(options.compilerOptions ?? {}) },
    plugins: "plugins" in options ? options.plugins : defaultOptions.plugins,
    project: options.project ?? defaultOptions.project,
    projectRoot: options.projectRoot ?? defaultOptions.projectRoot,
  };
}
