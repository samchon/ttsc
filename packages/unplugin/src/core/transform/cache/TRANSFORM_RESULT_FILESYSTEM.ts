import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * The filesystem operations currently registered for each compiler result.
 *
 * Recorded per result because a result outlives the delivery that produced it
 * and is revalidated later. Capture and delivery owners can replace the
 * registration and must keep its operations coherent with recorded observations;
 * the table does not establish equivalence between views. Weakly held, so a
 * disposed generation releases its entry.
 */
export const TRANSFORM_RESULT_FILESYSTEM = new WeakMap<
  ITtscCompilerTransformation,
  TtscTransformFilesystemOperations
>();
