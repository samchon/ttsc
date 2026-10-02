import type { ITtscCompilerTransformation } from "ttsc";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";

/**
 * The project each compiler result was captured for, with the membership policy
 * the capture's own walk proved the project's root files under, plus the exact
 * lexical directories a complete pre-compile membership walk enumerated.
 *
 * Recorded per result, as its filesystem view is
 * (`TRANSFORM_RESULT_FILESYSTEM`), because the reference graph is indexed once
 * per result and then read from every later delivery, and the index needs to
 * know which of the compiler's directory listings the walk already proves
 * (`envelopeGraphIndexes`). Policy eligibility alone does not prove traversal
 * through a link or successful enumeration. An incomplete pre-compile directory
 * walk or a subsequently different compiler case answer supplies an empty set;
 * a result captured without this association keeps every reported listing.
 */
export const TRANSFORM_RESULT_MEMBERSHIP = new WeakMap<
  ITtscCompilerTransformation,
  {
    /** Lexical visited paths; an empty set carries no enumeration authority. */
    enumeratedDirectories: ReadonlySet<string>;

    /** Immutable compiler selection policy for the captured project. */
    policy: ITtscProjectMembershipPolicy;

    /** Native lexical root from which the recorded walk started. */
    projectRoot: string;
  }
>();
