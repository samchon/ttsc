import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { declaredProjectInputKeys } from "../envelope/declaredProjectInputKeys";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { collectProjectInputSnapshot } from "../project/collectProjectInputSnapshot";
import { matchesCachedExternalInputs } from "./matchesCachedExternalInputs";
import { matchesExternalInputRealpaths } from "./matchesExternalInputRealpaths";
import { matchesUniversalHostInputEntries } from "./matchesUniversalHostInputEntries";
import { matchesUniversalHostInputProbes } from "./matchesUniversalHostInputProbes";
import { matchesUniversalHostInputTrees } from "./matchesUniversalHostInputTrees";
import { sameHashes } from "./sameHashes";
import { sameProjectDirectories } from "./sameProjectDirectories";
import { walkSnapshotComplete } from "./walkSnapshotComplete";

/**
 * Prove one generation from its own recorded snapshot, with no help from live
 * notifications.
 *
 * This is the fallback for a graph-free envelope and for a generation whose
 * watchers could not be opened or have since failed: losing the notification
 * proof must cost the narrow path, not the cache. The walk re-proves membership
 * directly — the recorded directory signatures plus the recorded file-key
 * universe — so a created, deleted, or renamed input still invalidates without
 * any watcher.
 *
 * The delivered module is compared from disk like every other input: the
 * compile read it from disk, so a delivered text that differs is not the file's
 * state (samchon/ttsc#1394). The delivery caller refreshes the generation's
 * native clock reference before this operation; this validator does not mint a
 * reference itself.
 *
 * @evidence contracts/common.md#principled-implementation Universal authority, declared project membership, content hashes and external physical targets must all match before project/external signatures and directory observations are adopted. Universal entry validators may independently refresh already qualified entry witnesses along the way.
 * @evidence contracts/common.md#clear-and-simple-design One complete-proof boundary composes domain validators and adopts aggregate project/external witnesses after combined success, while universal entry qualification stays with its owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed notifications neither prove unchanged state nor force recompilation when direct recorded-state validation can establish the same generation.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain lost-notification fallback, membership authority, disk-source comparison and the reason signatures are re-earned.
 * @evidence contracts/portability.md#os-neutral-implementation The recorded compiler membership policy and identity context qualify the native walk and lexical alias targets rather than assumed OS case rules.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Current directory observations are replaced; earned signatures merge into generation records, which may retain older entries rather than deleting every unearned witness. Storage follows that generation's directory/input spelling population and lazy identity/selection indexes, without an independent historical snapshot collection or new watcher handle here.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Universal entries/probes/tree environments precede a native membership
 *   walk. Declared keys avoid irrelevant byte hashes but do not skip directory
 *   enumeration. Directory/hash comparisons, external spelling and physical
 *   target scans, signature entry materialization/adoption and native identity
 *   work add population/path/digit costs; unresolved content and predicate
 *   replay add bytes/listings. Early rejection skips subsequent domains.
 * @evidence contracts/performance.md#reuse-equivalent-work Qualified separable signatures avoid repeated content reads under the caller's refreshed clock. Successful aggregate proof adopts earned project/external signatures and clears unverified flags; it neither clears recorded changes/failed flags nor makes later quiet notifications sufficient without their other admission conditions.
 */
export function matchesCompleteInputSnapshot(
  /**
   * Generation with a complete capture baseline and caller-refreshed clock
   * proof.
   */
  cached: TtscCachedProjectTransform,
): boolean {
  if (
    cached.projectSnapshotComplete !== true ||
    cached.projectDirectories === undefined
  ) {
    return false;
  }
  // Universal descriptor/config inputs carry a physical-identity proof that no
  // content comparison can replace: retargeting a symlinked input to a
  // byte-identical file selects a different file, and its own transitive
  // requires with it. Only the graph half of the out-of-walk snapshot records
  // realpaths, so without this the fallback would quietly hold a lower standard
  // than the narrow path it stands in for. A plugin's source is proven by its
  // state here too, since no walk reads it (samchon/ttsc#1487).
  const state = envelopeDerivation(cached);
  const hostValidation = cached.hostInputValidation;
  if (
    hostValidation === undefined ||
    !matchesUniversalHostInputEntries(cached, hostValidation) ||
    !matchesUniversalHostInputProbes(cached, hostValidation) ||
    !matchesUniversalHostInputTrees(cached, hostValidation)
  ) {
    return false;
  }
  const declaredInputs = declaredProjectInputKeys(state, cached);
  const current = collectProjectInputSnapshot(
    cached.projectRoot,
    state.identityContext,
    resultFilesystem(cached.result),
    cached.inputSignatures === undefined
      ? undefined
      : { hashes: cached.inputHashes, signatures: cached.inputSignatures },
    {
      // Judge membership by the rule the compile ran under, and read only the
      // inputs this comparison actually consults.
      declaredKeys: declaredInputs,
      policy: cached.membershipPolicy,
    },
  );
  if (!walkSnapshotComplete(current, declaredInputs)) {
    return false;
  }
  if (
    !sameProjectDirectories(
      cached.projectDirectories,
      current.projectDirectories,
    )
  ) {
    return false;
  }
  if (!sameHashes(cached.inputHashes, current.hashes, declaredInputs)) {
    return false;
  }
  // Re-hash the out-of-walk inputs the compiler reported for this generation
  // over exactly the recorded key universe, so an edit to a `node_modules`
  // declaration or a monorepo sibling source invalidates the entry even in a
  // host that never clears the cache between builds. A new out-of-walk input
  // cannot appear without some recorded input changing first: a new reference
  // edge requires editing an in-walk source, and a new global or config file
  // requires a tsconfig or package manifest change, both of which the project
  // walk above already detects.
  const externalCurrent = matchesCachedExternalInputs(cached);
  if (!externalCurrent.matches || !matchesExternalInputRealpaths(cached)) {
    return false;
  }
  adoptProvenSignatures(cached, {
    external: externalCurrent.signatures,
    project: current.provenSignatures,
  });
  // Adopt current directory witnesses, including newly observed directories
  // with no current program input. This assignment updates snapshot storage;
  // it does not register or replace a native watcher (samchon/ttsc#1419).
  cached.projectDirectories = current.projectDirectories;
  // Recorded inputs were proven by replay or qualified metadata, closing the
  // current notification gap. Failed flags and recorded changes remain for
  // later notification admission to judge (samchon/ttsc#1425).
  for (const tracker of [
    cached.projectMutationTracker,
    cached.hostInputMutationTracker,
    cached.candidateMutationTracker,
  ]) {
    if (tracker !== undefined) tracker.unverified = false;
  }
  return true;
}

/**
 * Adopt the signatures captured while this walk proved every recorded input
 * still carries its recorded content.
 *
 * Without this, a metadata-only change — a touch, or a rewrite of identical
 * bytes — costs a re-read on every later delivery for the rest of the
 * generation's life, because the recorded signature can never match again. The
 * narrow path self-heals through `matchesProvenInput`; this is the same refresh
 * for the path that proves the whole snapshot at once.
 *
 * The delivered file is no exception: its recorded hash is the disk's, like
 * every other input's, since the compile read it from disk
 * (samchon/ttsc#1394).
 */
function adoptProvenSignatures(
  cached: TtscCachedProjectTransform,
  proven: {
    external: Record<string, string>;
    project: Record<string, string>;
  },
): void {
  const projectSignatures = (cached.inputSignatures ??= {});
  for (const [key, signature] of Object.entries(proven.project)) {
    projectSignatures[key] = signature;
  }
  const externalSignatures = (cached.externalInputSignatures ??= {});
  for (const [spelling, signature] of Object.entries(proven.external)) {
    externalSignatures[spelling] = signature;
  }
}
