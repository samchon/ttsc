import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscAdoptionVerdict } from "./TtscAdoptionVerdict";

/**
 * Envelopes a worker adopted from its session instead of compiling, each with
 * the state of the publication it came from and whether that publication failed
 * its proof here (samchon/ttsc#1390, samchon/ttsc#1479).
 *
 * The retry of an adopted attempt that failed reads the verdict
 * (`transformProject`): a refuted publication is not adopted again for the same
 * state, and one this worker's own window merely moved around is.
 */
export const TRANSFORM_ADOPTED_RESULTS = new WeakMap<
  ITtscCompilerTransformation,
  TtscAdoptionVerdict
>();
