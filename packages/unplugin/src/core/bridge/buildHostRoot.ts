import path from "node:path";

/**
 * Resolve a configured native host root when configuration is received.
 * An omitted root stays omitted so the adapter can distinguish Farm's selected
 * location from the generic fallback. Resolution preserves lexical alias
 * spelling; it does not canonicalize the root through the filesystem.
 *
 * @evidence contracts/common.md#principled-implementation An explicit root is resolved using native path grammar and current configuration-time cwd; undefined remains the absence of a configured root.
 * @evidence contracts/common.md#clear-and-simple-design Configuration-time path resolution is separate from later default-root selection, so relative roots are anchored once while an omitted root remains dynamic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native path.resolve supplies grammar without platform guesses, filesystem alias replacement or a fabricated host root.
 * @evidence contracts/common.md#meaningful-documentation Native prose states resolution timing, the omitted-root distinction and lexical rather than physical identity.
 * @evidence contracts/portability.md#os-neutral-implementation Node's native path.resolve interprets volumes, separators and relative roots against actual cwd without changing a filesystem alias to its realpath.
 * @evidence contracts/performance.md#efficient-algorithms Explicit root resolution scans and normalizes path text and allocates its absolute spelling, without filesystem enumeration or identity probing; undefined performs no resolution.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation resolves its argument per configuration call; the caller stores the selected spelling rather than this operation caching it.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned path text transfers to the caller; no handle, watcher or retained state is acquired.
 */
export function resolveConfiguredHostRoot(
  root: string | undefined,
): string | undefined {
  return root === undefined ? undefined : path.resolve(root);
}

/**
 * Use a previously resolved configured root, or the process's current directory
 * at this invocation. A configured spelling remains fixed across cwd changes.
 *
 * @evidence contracts/common.md#principled-implementation Nullish fallback reads actual process.cwd only when no configured root exists; the configured string is returned unchanged.
 * @evidence contracts/common.md#clear-and-simple-design One selection supplies the root used by record locations and bridge admission without owning either resource or its proof.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fallback is the actual working directory, not a guessed project root or a fixture-specific path.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes invocation-time cwd from a configuration-time selected spelling.
 * @evidence contracts/portability.md#os-neutral-implementation Actual process.cwd supplies the native default; a selected volume and alias spelling pass through unchanged without filesystem canonicalization.
 * @evidenceExclude contracts/performance.md#efficient-algorithms This fixed optional-value selection chooses no population-processing algorithm; the fallback delegates one actual process.cwd query.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The default is queried on each invocation because cwd may change; no computed result is shared here.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Selection owns no retained state, watcher or handle; record and bridge lifetime remain with their callers.
 */
export function selectBuildHostRoot(configuredRoot: string | undefined): string {
  return configuredRoot ?? process.cwd();
}
