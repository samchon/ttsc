import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";

/**
 * Sample notification availability after tracker settlement.
 *
 * Absence is permitted because recorded-state validation retains its proof;
 * any present failed observer withdraws notification transfer as a whole.
 * The caller samples this before subsequent proof admission, preserving the
 * capture operation's established ordering.
 *
 * @evidence contracts/common.md#principled-implementation Every present project, host and candidate tracker must have settled without failure; an absent optional tracker does not invent a failure or coverage claim.
 * @evidence contracts/common.md#clear-and-simple-design One three-field predicate owns the sampled availability verdict consumed by later retention admission.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No observer health is inferred from successful compilation or another healthy tracker, and this operation creates no tracker or native capability.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains absent versus failed state and the production caller's exact sampling point.
 * @evidence contracts/portability.md#os-neutral-implementation The actual tracker interface supplies settled failure state independently of backend names and operating systems.
 * @evidence contracts/performance.md#efficient-algorithms At most three constant-time field reads establish availability without probing the filesystem or native backend again.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call samples current tracker state; the capture caller controls how long that sampled verdict applies.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate borrows tracker references without retaining or releasing their owned observers.
 */
export function generationNotificationsAvailable(
  project: TtscProjectMutationTracker | undefined,
  host: TtscProjectMutationTracker | undefined,
  candidate: TtscProjectMutationTracker | undefined,
): boolean {
  return project?.failed !== true && host?.failed !== true && candidate?.failed !== true;
}

/**
 * Transfer admitted notification authority to one captured generation.
 *
 * Actual observer creation, settlement and proof construction remain in the
 * capture owner. This operation attaches only qualified handles and returns
 * the exact ownership flags that its caller uses for finally cleanup.
 * The caller supplies a newly captured generation without prior tracker
 * ownership. Availability is its earlier settled sample, not a fresh health
 * check performed here; live tracker consumers still qualify current authority.
 *
 * @evidence contracts/common.md#principled-implementation Retention requires the caller's membership and notification policies, complete generation proof and sampled observer availability together; failure of any premise leaves every tracker with its local cleanup owner.
 * @evidence contracts/common.md#clear-and-simple-design One synchronous admission gate attaches three optional handles and returns their independent ownership flags; acquisition and finally cleanup stay with capture.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The supplied availability sample must cover every present observer rather than infer health from a sibling; missing snapshot authority cannot be promoted to complete proof, and no tracker is manufactured. This gate does not refresh the earlier sample.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the caller-owned creation and settlement steps and the exact cleanup responsibility conveyed by the return value.
 * @evidence contracts/portability.md#os-neutral-implementation Backend-independent tracker references transfer through their actual lifecycle interface; the gate adds no OS-name or path-case inference.
 * @evidence contracts/performance.md#efficient-algorithms One Boolean gate and at most three assignments avoid additional native observations or project scans.
 * @evidence contracts/performance.md#reuse-equivalent-work Qualified existing observers transfer with the generation instead of opening equivalent observers again; unavailable authority leaves recorded-state validation responsible for reuse.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Returned flags identify each transferred observer independently, including a candidate when another tracker is absent. The fresh generation gains at most three tracker references, whose watch populations/lifecycle stay with the tracker and disposal owners; this gate does not replace or release pre-existing generation handles. Untransferred handles remain owned by capture finally cleanup attempts.
 */
export function retainGenerationNotifications(props: {
  cached: TtscCachedProjectTransform;
  project: TtscProjectMutationTracker | undefined;
  host: TtscProjectMutationTracker | undefined;
  candidate: TtscProjectMutationTracker | undefined;
  retainProjectMembership: boolean;
  retainNotifications: boolean;
  stableProjectSnapshot: boolean;
  notificationsAvailable: boolean;
}): { project: boolean; host: boolean; candidate: boolean } {
  const notifying = props.retainProjectMembership && props.retainNotifications &&
    props.stableProjectSnapshot && props.notificationsAvailable;
  if (notifying && props.project !== undefined) props.cached.projectMutationTracker = props.project;
  if (notifying && props.host !== undefined) props.cached.hostInputMutationTracker = props.host;
  if (notifying && props.candidate !== undefined) props.cached.candidateMutationTracker = props.candidate;
  return {
    project: notifying && props.project !== undefined,
    host: notifying && props.host !== undefined,
    candidate: notifying && props.candidate !== undefined,
  };
}
