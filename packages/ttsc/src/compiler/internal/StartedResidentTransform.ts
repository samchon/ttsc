import { ResidentTransformProcess } from "./ResidentTransformProcess";

/**
 * A started resident transform host plus the project root its keys are relative
 * to.
 *
 * Returned by {@link startResidentTransform}. The two travel together because a
 * request names files by project-relative key, and a caller that resolved the
 * root differently from the host would ask about a file the host never loaded.
 */
export interface StartedResidentTransform {
  /** The live host process; dispose it when the service shuts down. */
  process: ResidentTransformProcess;

  /** Physical project root the host resolved its project against. */
  projectRoot: string;
}
