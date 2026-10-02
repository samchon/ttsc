import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import type { ResidentCheckTelemetry } from "./ResidentCheckTelemetry";

/**
 * Textual check output and Program activity for one
 * {@link ResidentCheckRequest}.
 *
 * The transport supplies status, stdout and stderr with an empty diagnostics
 * list. The watch coordinator reconstructs structured diagnostics from that
 * text using the same normalization as the one-shot check.
 *
 * @evidence contracts/common.md#principled-implementation Intersecting the ordinary build result with required telemetry preserves status and textual diagnostics while expressing how that particular resident cycle used its Program.
 * @evidence contracts/common.md#clear-and-simple-design The type adds only resident provenance to the existing result representation rather than duplicating the build result fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Telemetry describes the producer's actual cycle; the type supplies no synthetic successful status or measurement-only branch.
 * @evidence contracts/common.md#meaningful-documentation The native paragraph distinguishes the result from its residency metadata, and the member comment identifies telemetry purpose following the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type ResidentCheckResult = TtscBuildResult & {
  /** How the sidecar served this cycle. */
  telemetry: ResidentCheckTelemetry;
};
