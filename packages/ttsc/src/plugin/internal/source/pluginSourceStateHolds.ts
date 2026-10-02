import { pluginSourceDigest } from "./pluginSourceDigest";
import { pluginSourceState } from "./pluginSourceState";
import { processPluginBuildEnvironment } from "./processPluginBuildEnvironment";

/**
 * Whether one plugin source directory still holds the state a transform
 * reported for it (`pluginSourceState`), under this process's environment.
 *
 * The sources are read now, unless the caller hands over their digest
 * (`pluginSourceDigest`) from a reading it can vouch for still holding, as a
 * consumer that re-proves a source on every delivery does once the metadata of
 * every file the digest reads (`collectPluginSourceFiles`) is unchanged. The
 * environment is this process's reading (`processPluginBuildEnvironment`),
 * which is read again whenever the Go tool, its environment file, or the C
 * toolchain it names moved, and read again before a state that does not match
 * is refuted. A compile keys its binaries on a fresh read, so a state it
 * reported after a change gets one comparison with a refreshed environment.
 * That retry does not guarantee equality for a changing or differently keyed
 * environment, and a supplied source digest remains the caller's premise.
 *
 * @param directory The source directory, as the envelope names it.
 * @param state The state the envelope reported.
 * @param options.sourceDigest The directory's `pluginSourceDigest`, when the
 *   caller holds one it can vouch for.
 *
 * @throws When a listed source file cannot be read, as the build itself would.
 *
 * @evidence contracts/common.md#principled-implementation Equality uses shared state composition and one real environment refresh after mismatch. This allows changed observations to be reconsidered without certifying the second comparison must match; supplied digest validity and native witness premises remain with their owners.
 * @evidence contracts/common.md#clear-and-simple-design One source reading is passed through both attempts and only the environment owner performs the refresh.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Refresh corrects a genuinely changed environment reading rather than adding exceptions for particular digest values or consumers.
 * @evidence contracts/common.md#meaningful-documentation The prose states source-digest provenance, environment invalidation and the reason a mismatching state gets a fresh comparison.
 * @evidence contracts/portability.md#os-neutral-implementation Source reads and Go/environment witnesses use the same native boundary implementations as builds, rather than comparing OS names or guessed installation paths.
 * @evidence contracts/performance.md#efficient-algorithms At most one source digest computation is requested and reused by both comparisons; supplied strings bypass it. Native enumeration/file bytes, full environment identity/witness checks, optional tool/SDK refresh and digest-string hashing contribute work; mismatch repeats environment resolution once rather than bounding total cost by comparison count.
 * @evidence contracts/performance.md#reuse-equivalent-work A caller's proven source digest and the process owner's still-valid environment are reused; a mismatch forces the owning environment refresh before returning false.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The proof owns no retained source buffer, process or watcher; its caller owns any saved source digest.
 */
export function pluginSourceStateHolds(
  directory: string,
  state: string,
  options: { sourceDigest?: string } = {},
): boolean {
  const sourceDigest = options.sourceDigest ?? pluginSourceDigest(directory);
  if (pluginSourceState(directory, { sourceDigest }) === state) return true;
  processPluginBuildEnvironment(directory, true);
  return pluginSourceState(directory, { sourceDigest }) === state;
}
