import type { TtscAdoptionVerdict } from "../session/TtscAdoptionVerdict";
import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";
import { createGenerationProofFailures } from "./createGenerationProofFailures";
import { onlyLearnedCompileFacts } from "./onlyLearnedCompileFacts";

/**
 * Select how one completed capture spends the retry owner's budgets. Supplied
 * facts describe the capture; this policy performs no capture or native proof.
 *
 * Coherent results return first. A local, lossless host-observation refusal can
 * transfer an incomplete local success. TtscGenerationProof owns any sharing of
 * its first module deliveries inside an explicit nonwatching pass; this policy
 * grants no independent native or persistent proof. Rejected attempts spend
 * movement only when they neither refute a publication nor solely learn facts.
 * Two movements or four captures stop retrying, retaining a current diagnostic
 * rather than a terminal instability verdict when its config is not refuted.
 *
 * The caller owns learned dependency/case carry, terminal validation, capture
 * disposal and result transfer. Selecting terminal does not certify a baseline
 * or cleanup, and selecting accepted does not independently prove input facts.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Capture flags govern coherent acceptance before retry classification. Only
 *   local stable successes with nonempty lossless host-unavailable failures get
 *   fresh-only transfer; refuted publication and learned-only exemptions retain
 *   the absolute cap, while other failures consume the movement budget.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A pure disposition returns classification and next scalar retry state;
 *   capture, mutable learning, validation lookup and cleanup remain caller-owned.
 *   Accepted and fresh-only literal variants stay separate so their exclusion
 *   leaves only dispositions carrying rejection state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No native backend substitution or test injection bypasses capture. Omitted,
 *   mixed and empty failures cannot establish the learned or fresh exemption.
 * @evidence contracts/common.md#meaningful-documentation
 *   Prose distinguishes acceptance, fresh transfer, bounded rejection and the
 *   caller's actual proof/resource responsibilities without claiming execution.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Classifies logical result flags, opaque publication keys and failure kinds;
 *   it interprets no native coordinate, filesystem capability or process value.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Scalar guards precede at most two short-circuit failure scans. Work follows
 *   supplied entry count and kind text; no dependency population is copied here.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Each capture's supplied flags and budgets can differ; classification stores
 *   no memo and grants no authority to reuse a prior capture's native proof.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Results borrow the supplied failure aggregate or transfer a fresh empty one.
 *   No handle, task or historical state is retained; the caller owns attempts,
 *   terminal baselines and rejected-capture disposal.
 */
export function selectTransformAttemptDisposition(props: {
  /** Compiler envelope discriminator of this completed capture. */
  resultType: "success" | "failure" | "exception";

  /** Explicit config coherence; undefined retains the existing admission rule. */
  configStateComplete?: boolean;

  /** Reusable project success proof, required explicitly for success acceptance. */
  projectSnapshotComplete?: boolean;

  /** Capture-window stability; diagnostic acceptance rejects explicit false. */
  projectHeldStill?: boolean;

  /** Failure-envelope host observation completeness. */
  observationsComplete?: boolean;

  /** Number of producer-reported host proof failure entries. */
  hostInputProofFailureCount: number;

  /**
   * Optional recorded proof aggregate; absent rejection starts with empty
   * evidence.
   */
  failures?: TtscGenerationProofFailures;

  /** Publication origin and refutation, absent for a locally compiled attempt. */
  adopted?: TtscAdoptionVerdict;

  /** Zero-based index of this capture within the current retry loop. */
  attempt: number;

  /** Movement failures counted before this capture. */
  moved: number;

  /** Exact publication payload the caller's next capture must refuse, if any. */
  rejected?: string;
}):
  | {
      kind: "accepted";
      freshDeliveryOnly: boolean;
    }
  | {
      kind: "fresh-only";
      freshDeliveryOnly: boolean;
    }
  | {
      kind: "retry" | "diagnostic" | "terminal";
      freshDeliveryOnly: boolean;
      failures: TtscGenerationProofFailures;
      moved: number;
      rejected: string | undefined;
    } {
  const freshDeliveryOnly =
    props.resultType === "failure" &&
    (props.observationsComplete === false ||
      props.hostInputProofFailureCount !== 0);
  if (
    props.configStateComplete !== false &&
    (props.resultType === "success"
      ? props.projectSnapshotComplete === true
      : props.projectHeldStill !== false)
  ) {
    return { kind: "accepted", freshDeliveryOnly };
  }
  const failures = props.failures ?? createGenerationProofFailures();
  if (
    props.resultType === "success" &&
    props.configStateComplete === true &&
    props.projectHeldStill === true &&
    props.adopted === undefined &&
    failures.omitted === 0 &&
    failures.entries.length !== 0 &&
    failures.entries.every(
      (failure) =>
        failure.domain === "host" && failure.kind === "observation-unavailable",
    )
  ) {
    return { kind: "fresh-only", freshDeliveryOnly: true };
  }
  let moved = props.moved;
  let rejected = props.rejected;
  if (props.adopted?.refuted === true) rejected = props.adopted.publication;
  else if (!onlyLearnedCompileFacts(failures)) moved += 1;
  const last =
    moved === TRANSFORM_MOVEMENT_ATTEMPTS ||
    props.attempt + 1 === TRANSFORM_MOVEMENT_ATTEMPTS * 2;
  return {
    kind: !last
      ? "retry"
      : props.resultType !== "success" && props.configStateComplete !== false
        ? "diagnostic"
        : "terminal",
    freshDeliveryOnly,
    failures,
    moved,
    rejected,
  };
}

/** One movement retry; learned/refuted attempts still have twice this cap. */
const TRANSFORM_MOVEMENT_ATTEMPTS = 2;
