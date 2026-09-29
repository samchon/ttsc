import type { ITtscProjectInputSnapshot } from "../../../structures/internal/ITtscProjectInputSnapshot";
import { LSPProjectInputDigest } from "./LSPProjectInputDigest";

/**
 * Take the fingerprints of every reload directory and reload file of a snapshot
 * at the moment the language server's plugin selection is made.
 *
 * Reload directory digests describe immediate topology and physical identity;
 * reload file digests keep the leaf link while resolving its parent. The native
 * host can validate this startup baseline before accepting watcher coverage.
 *
 * @evidence contracts/common.md#principled-implementation Attaching each reload input's framed digest to the unchanged declaration preserves the selection-time baseline; later validators compare against those observations instead of blessing a newly sampled state.
 * @evidence contracts/common.md#clear-and-simple-design Two explicit lanes delegate file and directory semantics to the shared digest namespace and retain the original snapshot's other dependency fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Production startup uses these observations before native watcher registration; the exported helper serves that protocol rather than existing solely for parity tests.
 * @evidence contracts/common.md#meaningful-documentation Native documentation distinguishes topology from content and identifies the startup handoff, with separated tags following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation File leaves retain link identity and directory digests include actual physical identity through native resolvers; declared map keys are not blanket case-folded.
 * @evidence contracts/performance.md#efficient-algorithms One pass per reload lane delegates necessary file bytes or immediate directory entries; output grows with the declared reload population and does not traverse unrelated dependency files.
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
