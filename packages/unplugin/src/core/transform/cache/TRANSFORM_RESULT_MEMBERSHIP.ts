import type { ITtscCompilerTransformation } from "ttsc";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";

/**
 * The project each compiler result was captured for, with the membership policy
 * the capture's own walk proved the project's root files under.
 *
 * Recorded per result, as its filesystem view is
 * (`TRANSFORM_RESULT_FILESYSTEM`), because the reference graph is indexed once
 * per result and then read from every later delivery, and the index needs to
 * know which of the compiler's directory listings the walk already proves
 * (`envelopeGraphIndexes`). A result captured without one keeps every listing
 * it reported.
 */
export const TRANSFORM_RESULT_MEMBERSHIP = new WeakMap<
  ITtscCompilerTransformation,
  { policy: ITtscProjectMembershipPolicy; projectRoot: string }
>();
