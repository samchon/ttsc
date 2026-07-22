/** One active npm range that selected a mounted playground dependency. */
export interface IPlaygroundDependencyRequest {
  /** Declared npm range or tag. */
  range: string;
  /** Package or source entry that declared the range. */
  requester: string;
  /** Whether an unsatisfied request may be omitted. */
  optional: boolean;
}
