import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscFailedGenerationValidation } from "./TtscFailedGenerationValidation";

/** Retry baselines retained only for attempts that could not be published. */
export const TRANSFORM_FAILED_GENERATION_VALIDATIONS = new WeakMap<
  ITtscCompilerTransformation,
  TtscFailedGenerationValidation
>();
