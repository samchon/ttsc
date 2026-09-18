import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { declaredProjectInputKeys } from "../envelope/declaredProjectInputKeys";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { collectProjectInputSnapshot } from "../project/collectProjectInputSnapshot";
import { hashText } from "../utils/hashText";
import { matchesCachedExternalInputs } from "./matchesCachedExternalInputs";
import { matchesExternalInputRealpaths } from "./matchesExternalInputRealpaths";
import { matchesUniversalHostInputEntries } from "./matchesUniversalHostInputEntries";
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
 */
export function matchesCompleteInputSnapshot(
  cached: TtscCachedProjectTransform,
  currentKey: string,
  source: string,
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
  // than the narrow path it stands in for.
  const state = envelopeDerivation(cached);
  const hostValidation = cached.hostInputValidation;
  if (
    hostValidation === undefined ||
    !matchesUniversalHostInputEntries(cached, hostValidation)
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
  if (Object.prototype.hasOwnProperty.call(cached.inputHashes, currentKey)) {
    current.hashes[currentKey] = hashText(source);
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
    currentKey,
    external: externalCurrent.signatures,
    project: current.provenSignatures,
  });
  return true;
}

/**
 * Adopt the signatures captured while this walk proved every recorded input
 * still carries its recorded content.
 *
 * Without this, a metadata-only change — a touch, or a rewrite of identical
 * bytes — costs a re-read on every later delivery for the rest of the
 * generation's life, because the recorded signature can never match again. The
 * narrow path self-heals through {@link matchesProvenInput}; this is the same
 * refresh for the path that proves the whole snapshot at once.
 *
 * The delivered file is the single exclusion: its recorded hash is the source
 * the bundler supplied, so the disk bytes this walk read for it were compared
 * against nothing.
 */
function adoptProvenSignatures(
  cached: TtscCachedProjectTransform,
  proven: {
    currentKey: string;
    external: Record<string, string>;
    project: Record<string, string>;
  },
): void {
  const projectSignatures = (cached.inputSignatures ??= {});
  for (const [key, signature] of Object.entries(proven.project)) {
    if (key === proven.currentKey) continue;
    projectSignatures[key] = signature;
  }
  const externalSignatures = (cached.externalInputSignatures ??= {});
  for (const [spelling, signature] of Object.entries(proven.external)) {
    externalSignatures[spelling] = signature;
  }
}
