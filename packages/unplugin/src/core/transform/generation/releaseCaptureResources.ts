import { disposeFilesystemClockReference } from "../clock/disposeFilesystemClockReference";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";
import { removeCaptureScratch } from "./removeCaptureScratch";

/**
 * Finish local capture cleanup before admitted resources can leave its owner.
 *
 * Independent untransferred trackers, scratch storage and the clock reference
 * are attempted in their established finally order. A cleanup failure prevents
 * transfer: waiting retained trackers and the retained reference are then also
 * released. Secondary retained-close failures do not replace that cleanup
 * failure, and an already failed capture keeps its original exception.
 *
 * The caller releases its shared claim first and registers the returned clock
 * ownership only after this operation succeeds. Native close/removal failures
 * can leave underlying resources; attempting every owner does not prove
 * release.
 *
 * @evidence contracts/common.md#principled-implementation Nested finally attempts all unretained resources even after a tracker close throws. Failed local cleanup rolls back every waiting retained owner; the existing capture-error flag controls whether cleanup may replace the earlier exception.
 * @evidence contracts/common.md#clear-and-simple-design One effectful release operation owns local cleanup and failed-transfer rollback; acquisition, retention admission, shared claim release and final clock registration remain with capture.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Uses the actual tracker close capabilities and native scratch/probe removers without test-only callbacks or fabricated release receipts. Cleanup failure cannot return a transferable generation.
 * @evidence contracts/common.md#meaningful-documentation Native prose states cleanup order, error precedence, transfer ownership and the limits of native release attempts; props document individual retained owners.
 * @evidence contracts/portability.md#os-neutral-implementation Invokes supplied native tracker close capabilities and shared native-path scratch/reference cleanup. No OS label guarantees watcher closure or removal of busy and permission-denied storage.
 * @evidence contracts/performance.md#efficient-algorithms At most three local and three retained tracker close calls are attempted, plus scratch removal and clock disposal. Delegated work follows each tracker's watcher population and scratch descendants/native retries; fixed owner count does not bound native IO duration or resource bytes.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Cleanup effects apply to this capture's owners; there is no reusable calculation or cross-capture cleanup cache.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Successful cleanup leaves only admitted owners for caller transfer. Failed cleanup attempts every waiting retained owner before rejecting or preserving the capture error. No retry task or history is stored here; native failures can leave watchers or storage after ownership cleanup.
 */
export async function releaseCaptureResources(props: {
  /** Capture-local project membership observer, when acquired. */
  project?: TtscProjectMutationTracker;

  /** Capture-local declared host-input observer, when acquired. */
  host?: TtscProjectMutationTracker;

  /** Capture-local candidate observer, when acquired. */
  candidate?: TtscProjectMutationTracker;

  /** Whether the project observer is waiting for generation transfer. */
  retainProject: boolean;

  /** Whether the host observer is waiting for generation transfer. */
  retainHost: boolean;

  /** Whether the candidate observer is waiting for generation transfer. */
  retainCandidate: boolean;

  /** Owned compiler scratch tree, always removed before return. */
  scratchDirectory: string;

  /** Separate owned clock-reference directory, if created. */
  clockReferenceDirectory?: string;

  /** Whether the reference is waiting for returned-generation ownership. */
  retainClockReference: boolean;

  /** Preserve an exception already escaping the caller's capture body. */
  captureFailed: boolean;
}): Promise<void> {
  let cleanupFailed = false;
  let cleanupFailure: unknown;
  try {
    try {
      if (!props.retainProject && props.project !== undefined) {
        props.project.close();
      }
    } finally {
      try {
        if (!props.retainHost && props.host !== undefined) {
          props.host.close();
        }
      } finally {
        try {
          if (!props.retainCandidate && props.candidate !== undefined) {
            props.candidate.close();
          }
        } finally {
          try {
            await removeCaptureScratch(props.scratchDirectory);
          } finally {
            if (
              !props.retainClockReference &&
              props.clockReferenceDirectory !== undefined
            ) {
              disposeFilesystemClockReference(props.clockReferenceDirectory);
            }
          }
        }
      }
    }
  } catch (error) {
    cleanupFailed = true;
    cleanupFailure = error;
  }
  if (cleanupFailed) {
    // No generation can transfer after its local cleanup has failed. Preserve
    // the selected cleanup failure while attempting every retained owner.
    for (const retained of [
      props.retainProject ? props.project : undefined,
      props.retainHost ? props.host : undefined,
      props.retainCandidate ? props.candidate : undefined,
    ]) {
      try {
        retained?.close();
      } catch {
        // Continue attempting independent generation-owned resources.
      }
    }
    if (
      props.retainClockReference &&
      props.clockReferenceDirectory !== undefined
    ) {
      disposeFilesystemClockReference(props.clockReferenceDirectory);
    }
    if (!props.captureFailed) throw cleanupFailure;
  }
}
