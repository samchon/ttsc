/**
 * One active npm range that selected a mounted playground dependency.
 *
 * @evidence contracts/common.md#principled-implementation Range, requester and optionality preserve the constraint and its origin so mounted-version compatibility can be assessed.
 * @evidence contracts/common.md#clear-and-simple-design A constraint record separates dependency edges from mounted package identity.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Optionality explicitly permits omission; a missing required edge is not disguised as successful reuse.
 * @evidence contracts/common.md#meaningful-documentation Member JSDoc explains declared range, origin and omission meaning, following documentation-skill member spacing.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
export interface IPlaygroundDependencyRequest {
  /** Declared npm range or tag. */
  range: string;

  /** Package or source entry that declared the range. */
  requester: string;

  /** Whether an unsatisfied request may be omitted. */
  optional: boolean;
}
