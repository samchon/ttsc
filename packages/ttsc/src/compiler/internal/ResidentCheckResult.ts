import type { TtscBuildResult } from "../../structures/internal/TtscBuildResult";
import type { ResidentCheckTelemetry } from "./ResidentCheckTelemetry";

/**
 * The reply to one {@link ResidentCheckRequest}: the same result a one-shot
 * check would have produced, plus evidence of how the resident Program was
 * reused to produce it.
 */
export type ResidentCheckResult = TtscBuildResult & {
  /** How the sidecar served this cycle. */
  telemetry: ResidentCheckTelemetry;
};
