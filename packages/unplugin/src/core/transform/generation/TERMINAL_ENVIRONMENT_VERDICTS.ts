import type { TtscFailedGenerationValidation } from "./TtscFailedGenerationValidation";

/**
 * The environment verdict each terminal failed generation reached in the
 * current event-loop turn (samchon/ttsc#1398).
 *
 * A page load delivers hundreds of modules while a terminal verdict is
 * replayed, and each delivery asked whether the environment had changed by
 * walking the project and re-reading every recorded input. One answer per turn
 * is shared by every delivery of that turn, and it is dropped on the next turn
 * so a later change is still seen.
 */
export const TERMINAL_ENVIRONMENT_VERDICTS = new WeakMap<
  TtscFailedGenerationValidation,
  boolean
>();
