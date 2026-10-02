/**
 * Whether a failed rename of a lock candidate into its own directory lost a
 * race for the destination, the one way both build-lock protocols publish a
 * generation.
 *
 * The candidate was just created in the destination's directory, so that
 * directory is writable, and Windows reports a destination another process
 * holds, or one it is deleting, as `EPERM` or `EACCES`. A holder that releases
 * between the failed rename and a later look at the destination leaves nothing
 * to see, so asking whether the destination exists would take the lost race for
 * a permission failure. The error alone decides.
 *
 * @param error What the rename threw.
 *
 * @returns Whether the caller lost the destination to another process.
 *
 * @evidence contracts/common.md#principled-implementation Collision errno includes Windows access refusals under the explicit just-created candidate/writable-parent premise; looking up the destination afterward cannot prove a transient race that has already disappeared.
 * @evidence contracts/common.md#clear-and-simple-design One classifier serves the two lock protocols while each caller owns candidate creation, polling and its retry deadline.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The access-error allowance is tied to the real lock-publication premise, not a blanket suppression of unrelated permissions or expected fixture outcomes.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the candidate ownership premise and disappearing-destination race, making this narrow classifier's permitted use visible.
 * @evidence contracts/portability.md#os-neutral-implementation Native collision errno differs on Windows; callers' writable-parent construction gives that difference a supported protocol basis rather than deriving arbitrary filesystem permission from an OS name.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources isContendedCandidateRename acquires no handle, buffer or cache and retains nothing after it returns.
 * @evidenceExclude contracts/performance.md#efficient-algorithms isContendedCandidateRename performs a fixed number of steps with no loop or recursion over caller data.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work isContendedCandidateRename computes one result per call, so there is no repeated work to share.
 */
export function isContendedCandidateRename(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return (
    code === "EEXIST" ||
    code === "ENOTEMPTY" ||
    code === "EACCES" ||
    code === "EPERM"
  );
}
