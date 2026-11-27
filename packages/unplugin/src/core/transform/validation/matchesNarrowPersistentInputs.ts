import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { selectWatchInputs } from "../envelope/selectWatchInputs";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";
import { notificationsProveMembership } from "../tracker/notificationsProveMembership";
import { reportsMembershipChange } from "../tracker/reportsMembershipChange";
import { generationWatchInputs } from "../watch/generationWatchInputs";
import type { TtscGenerationProof } from "./TtscGenerationProof";
import { matchesProvenInput } from "./matchesProvenInput";
import { matchesUniversalHostInputs } from "./matchesUniversalHostInputs";

const uncoveredInputs = new WeakMap<
  TtscCachedProjectTransform,
  {
    project: ReadonlySet<string> | undefined;
    host: ReadonlySet<string> | undefined;
    candidate: ReadonlySet<string> | undefined;
    complete: boolean;
  }
>();

/**
 * Validate one graph-bearing cached output against only the inputs that can
 * affect that file. The delivery validator establishes its complete baseline
 * before admitting this path. Here live project notifications qualify current
 * membership, and universal and derived inputs still require their own proof.
 *
 * Returns `undefined` when this narrow proof is unavailable — live
 * notifications can no longer prove membership, or the generation carries no
 * universal-input manifest. That is the absence of a proof, not evidence of a
 * change, so the caller falls back to complete-snapshot validation instead of
 * discarding the generation. A reported membership event, a changed universal
 * input, or a changed derived input is evidence, and returns `false`.
 *
 * @evidence contracts/common.md#principled-implementation Proven membership and a universal manifest qualify derived-input validation; undefined distinguishes unavailable narrow authority from an observed mismatch.
 * @evidence contracts/common.md#clear-and-simple-design One narrow boundary composes universal and per-input proofs while its caller owns complete-snapshot fallback.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Lost watcher authority cannot be converted to false unchanged data or an invented dependency set.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs distinguish baseline admission, current membership authority and the three-state verdict's required caller behavior.
 * @evidence contracts/portability.md#os-neutral-implementation Native lexical spelling qualifies exact manifest coverage while dependency selection and its validators use the generation's filesystem identity policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This boundary borrows generation trackers and manifests; their owners acquire and retire retained resources.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Fixed membership flag checks precede universal validation and one selected
 *   input scan. Universal costs include coverage/event comparisons, unresolved
 *   native probes/content and mandatory tree/environment qualification. A first
 *   module spelling also derives its graph/dependency union; each unskipped
 *   input pays native identity/metadata and any necessary predicate/content
 *   replay. Work follows these populations, path text and bytes, not just the
 *   number of modules or a fixed membership check.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Immutable envelope selections, universal manifests and currently qualified
 *   per-input signatures serve sibling deliveries. Universal validation is
 *   invoked on each call. Quiet authoritative scopes let sibling deliveries
 *   share the exact coverage decision. A candidate watcher only proves a
 *   recorded file-unavailability predicate. The native gate has already
 *   replayed direct external inputs. Other unproven inputs need the module's
 *   own selection.
 */
export function matchesNarrowPersistentInputs(
  /**
   * Generation whose baseline, trackers and input witnesses the caller
   * qualified.
   */
  cached: TtscCachedProjectTransform,
  /** Delivered file spelling selecting this envelope's dependency closure. */
  file: string,
  proof?: TtscGenerationProof.Transaction,
): boolean | undefined {
  if (reportsMembershipChange(cached)) {
    return false;
  }
  if (!notificationsProveMembership(cached)) {
    return undefined;
  }
  const state = envelopeDerivation(cached);
  const hostValidation = cached.hostInputValidation;
  if (hostValidation === undefined) {
    return undefined;
  }
  if (!matchesUniversalHostInputs(cached, hostValidation, proof)) {
    return false;
  }
  const verified =
    proof?.cached === cached &&
    proof.groupedWatchInputs === true &&
    proof.locations !== undefined;
  const project = verified
    ? quietCoverage(cached.projectMutationTracker)
    : undefined;
  const host = verified
    ? quietCoverage(cached.hostInputMutationTracker)
    : undefined;
  const candidate = verified
    ? quietCoverage(cached.candidateMutationTracker)
    : undefined;
  if (project !== undefined || host !== undefined || candidate !== undefined) {
    let uncovered = uncoveredInputs.get(cached);
    if (
      uncovered === undefined ||
      uncovered.project !== project ||
      uncovered.host !== host ||
      uncovered.candidate !== candidate
    ) {
      const direct = new Set(cached.directExternalInputs);
      uncovered = {
        project,
        host,
        candidate,
        complete: generationWatchInputs(cached).every(({ file }) => {
          if (
            hostValidation.covered.has(file) ||
            project?.has(file) ||
            host?.has(file) ||
            direct.has(file)
          )
            return true;
          const observation = cached.externalInputObservations?.[file];
          return (
            candidate?.has(file) === true &&
            observation?.fileExists === false &&
            Object.keys(observation).length === 1
          );
        }),
      };
      uncoveredInputs.set(cached, uncovered);
    }
    if (uncovered.complete) return true;
  }
  const inputs = selectWatchInputs({
    file,
    projectRoot: cached.projectRoot,
    result: cached.result,
    scratchDirectory: cached.scratchDirectory,
    temporaryTsconfig: cached.temporaryTsconfig,
  });
  for (const input of inputs) {
    // Skip by spelling, not identity: the manifest proved this exact path, and
    // an alias of the same physical file is a different input whose own
    // retarget nothing else would see.
    if (hostValidation.covered.has(path.resolve(input))) {
      continue;
    }
    if (!matchesProvenInput(cached, state, input)) {
      return false;
    }
  }
  return true;
}

/**
 * Covered spellings can stand for the whole quiet scope after its current
 * location and notification checks.
 */
function quietCoverage(
  tracker: TtscProjectMutationTracker | undefined,
): ReadonlySet<string> | undefined {
  return tracker?.contentAuthoritative === true &&
    !tracker.failed &&
    !tracker.unverified &&
    !tracker.changesOmitted &&
    !tracker.membershipChanged &&
    tracker.changes.size === 0 &&
    (tracker.unproven?.size ?? 0) === 0
    ? tracker.covered
    : undefined;
}
