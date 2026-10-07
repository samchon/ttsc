import { LSPProjectInputDigest } from "./LSPProjectInputDigest";

/**
 * Whether the currently available reload fingerprints equal the captured
 * baseline. Equal digests are a startup acceptance check, not proof of an
 * unchanged filesystem: unavailable-read markers can agree and reads are
 * sequential.
 *
 * @evidence contracts/common.md#principled-implementation Universal comparison of both reload lanes refuses the snapshot on the first differing digest; comparison uses the same capture functions and declared keys that produced the baseline.
 * @evidence contracts/common.md#clear-and-simple-design Two short-circuiting predicates keep topology and exact-file invalidation visible without duplicating digest framing or physical-path resolution.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing baselines or changed observations compare unequal rather than being replaced with a current digest to manufacture stability.
 * @evidence contracts/common.md#meaningful-documentation The native comment states the retained selection's validity question; acknowledgment spacing follows the documentation skill and leaves digest details with their documented owner.
 * @evidence contracts/portability.md#os-neutral-implementation Validation uses the same native topology and best-effort leaf-preserving path operations as capture, including their unresolved-path and unavailable-read fallbacks; platform names do not supply filesystem identity.
 * @evidence contracts/performance.md#efficient-algorithms Each supplied lane entry is checked at most once, including repeated paths, and a mismatch stops further work. Delegated work includes ancestor/path probes, possible Windows capability queries, topology byte comparisons and framing or whole-file bytes; peak temporary storage belongs to the current digest call.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Fresh filesystem observation is the validity boundary; caching a previous boolean has no independent invalidation proof and would hide an intervening change.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate retains neither snapshots nor handles after the call; its caller owns the baseline lifetime.
 */
export function initialLSPProjectInputSnapshotIsCurrent(
  snapshot: LSPProjectInputDigest.InitialLSPProjectInputSnapshot,
): boolean {
  return (
    (snapshot.reloadDirectories ?? []).every(
      (directory) =>
        snapshot.reloadDirectoryDigests[directory] ===
        LSPProjectInputDigest.lspProjectInputReloadDirectoryDigest(directory),
    ) &&
    (snapshot.reloadFiles ?? []).every(
      (file) =>
        snapshot.reloadFileDigests[file] ===
        LSPProjectInputDigest.lspProjectInputFileDigest(
          LSPProjectInputDigest.realLSPProjectInputEntryPath(file),
        ),
    )
  );
}
