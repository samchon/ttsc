import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import { LSPProjectInputDigest } from "./LSPProjectInputDigest";

/**
 * Capture reload-directory and reload-file fingerprints sequentially for the
 * startup baseline. These reads do not define one atomic selection instant.
 *
 * Reload directory digests describe immediate topology and physical identity;
 * reload file digests keep the leaf link while resolving its parent. The native
 * host can validate this startup baseline before accepting watcher coverage.
 *
 * @evidence contracts/common.md#principled-implementation Attaching each reload input's framed digest to the unchanged declaration preserves the selection-time baseline; later validators compare against those observations instead of blessing a newly sampled state.
 * @evidence contracts/common.md#clear-and-simple-design Two explicit lanes delegate file and directory semantics to the shared digest namespace and retain the original snapshot's other dependency fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Production startup uses these observations before native watcher registration; the exported helper serves that protocol rather than existing solely for parity tests.
 * @evidence contracts/common.md#meaningful-documentation Native documentation distinguishes topology from content and identifies the startup handoff, with separated tags following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation File leaves retain their entry coordinate and directory digests use available native identity observations with documented lexical/unavailable fallbacks; declared map keys are not blanket case-folded.
 * @evidence contracts/performance.md#efficient-algorithms Both lanes process every supplied entry, including duplicates, and delegate ancestor/path probes, possible Windows capability queries, immediate topology byte comparisons/framing or whole-file reads. Returned key/digest maps grow with distinct declared paths; current digest buffers coexist with maps already built, without unrelated dependency-file traversal.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This captures a fresh baseline for a selected session; reuse without observing current reload inputs could certify an older selection and belongs to neither this mapper nor its contract.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Digest maps transfer to the returned snapshot and hold no open handle or process-wide history.
 */
export function fingerprintInitialLSPProjectInputSnapshot(
  snapshot: ITtscProjectInputSnapshot,
): LSPProjectInputDigest.InitialLSPProjectInputSnapshot {
  const reloadDirectoryDigests: Record<string, string> = {};
  const reloadFileDigests: Record<string, string> = {};
  for (const directory of snapshot.reloadDirectories ?? []) {
    reloadDirectoryDigests[directory] =
      LSPProjectInputDigest.lspProjectInputReloadDirectoryDigest(directory);
  }
  for (const file of snapshot.reloadFiles ?? []) {
    reloadFileDigests[file] = LSPProjectInputDigest.lspProjectInputFileDigest(
      LSPProjectInputDigest.realLSPProjectInputEntryPath(file),
    );
  }
  return {
    ...snapshot,
    reloadDirectoryDigests,
    reloadFileDigests,
  };
}
