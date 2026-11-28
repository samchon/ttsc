import path from "node:path";

import { HostInputObservationPhase } from "./HostInputObservationPhase";

/**
 * Content hash of each host input, keyed by its resolved path; `null` for an
 * input that cannot be read. A persistent plugin cache compares these against
 * the hashes it recorded to decide whether a descriptor must be evaluated
 * again.
 *
 * When a caller supplies a {@link HostInputObservationPhase.Phase}, hashing and
 * physical-path resolution share candidate metadata, skip descendants of
 * already-observed missing or non-directory parents, and drop the phase memo
 * when that synchronous phase ends. A fresh phase can qualify a dense group
 * before individual lookup when native open can refuse following links.
 *
 * @evidence contracts/common.md#principled-implementation Resolved path keys pair readable content with SHA-256, directory kind with a domain marker, and unavailable input with null; consumers must pair this content projection with physical identity.
 * @evidence contracts/common.md#clear-and-simple-design The operation snapshots supplied inputs only, delegating phase-scoped lstat, absent-parent and content hashing to HostInputObservationPhase while leaving discovery and cache acceptance with their respective owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The directory marker encodes type, not an expected answer; symlink parents never short-circuit descendants, and unreadability stays null rather than synthetic content or a known-path bypass.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc states null's unreadable meaning, phase-scoped sharing and downstream comparison purpose; descriptive and acknowledgment paragraphs are separated following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve and delegated lstat/stat/readFile preserve host path semantics and follow links; directory kind comes from actual filesystem metadata rather than separators or platform-name inference.
 * @evidence contracts/performance.md#efficient-algorithms A fresh phase can qualify exact ordinary files in a bounded scan and guarded read. Other independent paths incur at most one lstatSync per phase. Observed unavailable ancestors and duplicate resolved keys avoid repeated work. Directories return a marker and symlinks follow statSync.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work An optional caller-owned phase memo shares lstat and content-hash observations across overlapping checks within one synchronous verification phase and is dropped when that phase ends; without a caller phase, a call-local phase serves only the current call and is dropped on return.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous file APIs close their own descriptors and the returned record is caller-owned; this snapshot keeps no global collection or acquired handle.
 */
export function hashHostInputPaths(
  files: readonly string[],
  observed?: Map<string, string | null> | HostInputObservationPhase.Phase,
  observe?: (file: string) => string | null,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  if (observe !== undefined) {
    const map = HostInputObservationPhase.isPhase(observed)
      ? observed.hashes
      : observed;
    for (const file of files) {
      const resolved = path.resolve(file);
      if (Object.prototype.hasOwnProperty.call(out, resolved)) continue;
      let digest: string | null;
      if (map !== undefined && map.has(resolved)) {
        digest = map.get(resolved)!;
      } else {
        digest = observe(resolved);
        map?.set(resolved, digest);
      }
      out[resolved] = digest;
    }
    return out;
  }
  const phase = HostInputObservationPhase.isPhase(observed)
    ? observed
    : HostInputObservationPhase.create();
  const legacyMap = HostInputObservationPhase.isPhase(observed)
    ? undefined
    : observed;
  if (legacyMap === undefined)
    HostInputObservationPhase.hashKnownFiles(files, phase);
  for (const file of files) {
    const resolved = path.resolve(file);
    if (Object.prototype.hasOwnProperty.call(out, resolved)) continue;
    let digest: string | null;
    if (legacyMap !== undefined && legacyMap.has(resolved)) {
      digest = legacyMap.get(resolved)!;
    } else {
      digest = HostInputObservationPhase.hash(resolved, phase);
      legacyMap?.set(resolved, digest);
    }
    out[resolved] = digest;
  }
  return out;
}
