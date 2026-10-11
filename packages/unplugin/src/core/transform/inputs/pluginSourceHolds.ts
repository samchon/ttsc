import { pluginSourceState, pluginSourceStateHolds } from "ttsc/plugin-source";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { pluginSourceFilesDigest } from "./pluginSourceFilesDigest";

/**
 * Whether one plugin source directory still holds the state a transform
 * reported for it: its sources and the environment a build there is keyed on
 * (`pluginSourceStateHolds` from `ttsc/plugin-source`, samchon/ttsc#1493).
 *
 * The shared state owner reuses a build-environment reading while its toolchain
 * witnesses hold, and refreshes that environment before rejecting a mismatch.
 * This avoids repeatedly rejecting a new build solely because the consumer
 * retained an older environment reading.
 *
 * The source digest is reused only while metadata and fresh clock-separability
 * evidence permit it. Otherwise source bytes are read again. Unavailable source
 * or environment observations return false rather than proving unchanged state.
 * Async generation and delivery owners can supply an environment they just
 * qualified through the shared reading owner. That path performs no cold native
 * fallback; unavailable authority returns false and its async owner prepares a
 * fresh reading before admitting a replacement.
 *
 * @param directory The source directory, as the envelope names it.
 * @param state The state the envelope, a record, or a capture recorded.
 * @param filesystem The operations whose clock reference the caller refreshed.
 * @param prepared Optional already-qualified native environment authority.
 * @param projectRoot Project whose plugin cache records prove the sources and
 *   the SDK in a new process (samchon/ttsc#1725).
 * @evidence contracts/common.md#principled-implementation Source-state equality uses ttsc's build-key composition. Synchronous clients retain mismatch-triggered environment refresh; async clients supply current native authority and own fresh preparation separately. Unavailable source or prepared environment rejects proof.
 * @evidence contracts/common.md#clear-and-simple-design This adapter supplies a proven source digest to the shared state comparator, keeping environment composition and refresh in ttsc's owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fresh environment comparison corrects an actual stale environment witness; unreadable source is not hidden by expected state exceptions or perpetual compensating retries.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain source versus environment proof, failure semantics and refreshed-clock parameters, followed by separated tags under documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral source/environment comparison uses the build's native boundaries. Injected metadata must describe that same native source tree; arbitrary foreign-filesystem views are not established by this adapter.
 * @evidence contracts/performance.md#efficient-algorithms One proven source digest serves either the supplied-environment comparison or both synchronous environment comparisons; file work is delegated to the digest owner.
 * @evidence contracts/performance.md#reuse-equivalent-work Metadata-proven source digests and current native environment witnesses qualify reuse; async preparation and synchronous mismatch refresh remain distinct owning paths. A named project lets the source and SDK readings come from its plugin cache records across processes.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This comparison acquires no retained source cache or native handle; digest storage and process-environment retention have separate owners.
 */
export function pluginSourceHolds(
  directory: string,
  state: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  prepared?: { environment: string | undefined },
  projectRoot?: string,
): boolean {
  try {
    const sourceDigest = pluginSourceFilesDigest(
      directory,
      filesystem,
      projectRoot,
    );
    if (prepared !== undefined)
      return (
        prepared.environment !== undefined &&
        pluginSourceState(directory, {
          environment: prepared.environment,
          sourceDigest,
        }) === state
      );
    return pluginSourceStateHolds(directory, state, {
      projectRoot,
      sourceDigest,
    });
  } catch {
    return false;
  }
}
