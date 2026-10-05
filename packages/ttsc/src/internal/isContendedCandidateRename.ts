/**
 * Whether a lock-candidate rename refusal is classified as contention by the
 * publication policy used by both build-lock protocols.
 *
 * The candidate was just created in the destination's directory, so that
 * directory accepted that allocation. Windows access refusals can occur when
 * another process holds or is deleting the destination. A holder that releases
 * between the failed rename and a later look at the destination leaves nothing
 * to see, so asking whether the destination exists would take the lost race for
 * a permission failure. The policy therefore classifies the error code without
 * that lookup; allocation does not prove that later source/destination-specific
 * permissions permit renaming, nor does the code identify a peer. The input
 * must be a native error object or errno record; nullish thrown values are not
 * a supported record for this classifier.
 *
 * @param error What the rename threw.
 * @returns Whether the refusal is eligible for the caller's contention path.
 * @evidence contracts/common.md#principled-implementation The protocol's accepted codes include access refusals under the just-created candidate premise. A later destination lookup cannot identify a disappeared race, and the code itself does not prove that another process caused the refusal.
 * @evidence contracts/common.md#clear-and-simple-design One classifier serves the two lock protocols while each caller owns candidate creation, polling and its retry deadline.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The access-error allowance is tied to the real lock-publication premise, not a blanket suppression of unrelated permissions or expected fixture outcomes.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the candidate ownership premise and disappearing-destination race, making this narrow classifier's permitted use visible.
 * @evidence contracts/portability.md#os-neutral-implementation The shared protocol classifies EEXIST/ENOTEMPTY and Windows-style access refusal codes through native errno representation. Successful candidate allocation is a sampled premise, not an OS-wide permission guarantee or proof of a peer cause.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources isContendedCandidateRename acquires no handle, buffer or cache and retains nothing after it returns.
 * @evidence contracts/performance.md#efficient-algorithms One native error-code read and at most four exact comparisons classify the supplied record without filesystem lookup or text traversal; supported native errno records provide that property, while arbitrary accessor behavior is not a bounded native observation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This predicate coordinates no completed or in-flight work across requests; it classifies the current supplied refusal and leaves polling and admission state with the protocols.
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
