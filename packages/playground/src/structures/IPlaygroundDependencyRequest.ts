/**
 * One active npm range that selected a mounted playground dependency.
 *
 * @evidence contracts/common.md#principled-implementation Range, requester and optionality preserve the constraint and its origin so mounted-version compatibility can be assessed.
 * @evidence contracts/common.md#clear-and-simple-design A constraint record separates dependency edges from mounted package identity.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Optionality explicitly permits omission; a missing required edge is not disguised as successful reuse.
 * @evidence contracts/common.md#meaningful-documentation Member JSDoc explains declared range, origin and omission meaning, following documentation-skill member spacing.
 */
export interface IPlaygroundDependencyRequest {
  /** Declared npm range or tag. */
  range: string;

  /** Package or source entry that declared the range. */
  requester: string;

  /** Whether an unsatisfied request may be omitted. */
  optional: boolean;
}
