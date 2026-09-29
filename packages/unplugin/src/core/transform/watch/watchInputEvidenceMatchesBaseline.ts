import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { sameHostInputRealpath } from "../inputs/sameHostInputRealpath";
import type { TtscWatchInputBaseline } from "./TtscWatchInputBaseline";
import type { TtscWatchInputEvidence } from "./TtscWatchInputEvidence";
import type { TtscWatchInputKeyBaseline } from "./TtscWatchInputKeyBaseline";
import { isWatchInputKeyBaseline } from "./isWatchInputKeyBaseline";

/**
 * Compare generation evidence with the main process's exact key baseline.
 *
 * A codec matches only the facts the baseline actually captured. Listing and
 * plugin-tree observations require their optional payloads; membership is a
 * separate project walk and cannot match one path's baseline.
 *
 * @evidence contracts/common.md#principled-implementation Identity and every recorded codec fact must agree with a validated baseline; narrow discovery facts cannot establish broad read, target or listing predicates, and absent optional facts do not gain a match.
 * @evidence contracts/common.md#clear-and-simple-design Codec branches reuse the strict baseline guard and native realpath comparator, with one private refinement exposing the broader carrier.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown state and unsupported membership fail comparison, while older baselines without a listing cannot silently validate a newly recorded listing predicate.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain optional observation coverage and membership limits, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Realpaths compare through actual native identity capabilities; listing names remain observed compiler values rather than case-folded OS assumptions.
 * @evidence contracts/performance.md#efficient-algorithms The validated fixed shape is compared by codec; listing comparison is O(E) in recorded names and only physical-target predicates request native identity resolution.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The baseline is already captured by its key owner; this comparison stores no reusable verdict independent of that baseline's temporal validity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The comparison retains no cache or native handle; its identity context and ordered entry comparison are call-local.
 */
export function watchInputEvidenceMatchesBaseline(
  evidence: TtscWatchInputEvidence,
  baseline: TtscWatchInputKeyBaseline,
): boolean {
  if (
    !isWatchInputKeyBaseline(baseline) ||
    evidence.identity !== baseline.identity ||
    evidence.state === undefined
  ) {
    return false;
  }
  const broad = broadWatchInputBaseline(baseline);
  if (evidence.state.codec === "host") {
    return broad !== undefined && evidence.state.hash === broad.hostHash;
  }
  const identities = createHostPathIdentityContext();
  if (evidence.state.codec === "graph") {
    return (
      broad !== undefined &&
      evidence.state.hash === broad.graphHash &&
      sameHostInputRealpath(
        evidence.state.realpath,
        broad.realpath.ok ? broad.realpath.path : null,
        identities,
      )
    );
  }
  // A key baseline records one path's own state, and the project's root-file
  // membership is a walk over many; it never stands for one.
  if (evidence.state.codec === "membership") return false;
  // A plugin source directory's state is a walk over many files too, and a
  // key baseline carries it only where it was captured as one.
  if (evidence.state.codec === "tree") {
    return broad !== undefined && broad.tree === evidence.state.digest;
  }
  const observation = evidence.state.observation;
  if (
    observation.accessibleEntries !== undefined &&
    (broad?.accessibleEntries === undefined ||
      !sameEntryNames(
        observation.accessibleEntries.directories,
        broad.accessibleEntries.directories,
      ) ||
      !sameEntryNames(
        observation.accessibleEntries.files,
        broad.accessibleEntries.files,
      ))
  ) {
    return false;
  }
  if (
    observation.fileExists !== undefined &&
    observation.fileExists !== baseline.fileExists
  ) {
    return false;
  }
  if (
    observation.directoryExists !== undefined &&
    (broad === undefined ||
      observation.directoryExists !== broad.directoryExists)
  ) {
    return false;
  }
  if (
    observation.stat !== undefined &&
    (broad === undefined || observation.stat !== broad.stat)
  ) {
    return false;
  }
  if (
    observation.readFile !== undefined &&
    (broad === undefined ||
      (observation.readFile.ok &&
        observation.readFile.hash !== broad.graphReadHash) ||
      (!observation.readFile.ok && broad.graphReadHash !== null))
  ) {
    return false;
  }
  if (observation.realpath !== undefined) {
    if (broad === undefined) {
      return false;
    }
    if (observation.realpath.ok !== broad.realpath.ok) {
      return false;
    }
    if (
      observation.realpath.ok &&
      broad.realpath.ok &&
      !sameHostInputRealpath(
        observation.realpath.path,
        broad.realpath.path,
        identities,
      )
    ) {
      return false;
    }
  }
  return true;
}

/** Return a broad baseline after the complete entry has been validated. */
function broadWatchInputBaseline(
  baseline: TtscWatchInputKeyBaseline,
): TtscWatchInputBaseline | undefined {
  return "directoryExists" in baseline ? baseline : undefined;
}

/** Compare ordered entry values without allocating serialized copies. */
function sameEntryNames(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; ++index) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
