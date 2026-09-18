/** One exact file predicate consulted by nearest-project discovery. */
export interface TtscProjectTsconfigCandidate {
  readonly file: string;
  readonly fileExists: boolean;
}
