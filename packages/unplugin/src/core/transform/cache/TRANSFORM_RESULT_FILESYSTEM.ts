import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * The filesystem view each compiler result was captured through.
 *
 * Recorded per result because a result outlives the delivery that produced it
 * and is revalidated later, from other deliveries, which must read the same
 * filesystem the capture read. Weakly held, so a disposed generation releases
 * its entry.
 */
export const TRANSFORM_RESULT_FILESYSTEM = new WeakMap<
  ITtscCompilerTransformation,
  TtscTransformFilesystemOperations
>();
