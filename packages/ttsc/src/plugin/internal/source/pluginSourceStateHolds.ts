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
 * reported after a change is matched on the second reading, and no consumer
 * keeps refuting output its own compiler just produced.
 *
 * @param directory The source directory, as the envelope names it.
 * @param state The state the envelope reported.
 * @param options.sourceDigest The directory's `pluginSourceDigest`, when the
 *   caller holds one it can vouch for.
 *
 * @throws When a listed source file cannot be read, as the build itself would.
 *
 * @evidence contracts/common.md#principled-implementation Equality uses the shared state composition; a mismatch refreshes the kept environment once so a state produced after an external environment change is not falsely refuted forever.
 * @evidence contracts/common.md#clear-and-simple-design One source reading is passed through both attempts and only the environment owner performs the refresh.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Refresh corrects a genuinely changed environment reading rather than adding exceptions for particular digest values or consumers.
 * @evidence contracts/common.md#meaningful-documentation The prose states source-digest provenance, environment invalidation and the reason a mismatching state gets a fresh comparison.
 * @evidence contracts/portability.md#os-neutral-implementation Source reads and Go/environment witnesses use the same native boundary implementations as builds, rather than comparing OS names or guessed installation paths.
 * @evidence contracts/performance.md#efficient-algorithms Source bytes are read at most once per call; both comparisons reuse that digest and only the mismatch path repeats environment resolution.
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
