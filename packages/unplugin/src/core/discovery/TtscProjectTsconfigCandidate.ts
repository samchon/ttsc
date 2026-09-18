/** One exact file predicate consulted by nearest-project discovery. */
export interface TtscProjectTsconfigCandidate {
  /** Absolute `tsconfig.json` spelling the walk probed. */
  readonly file: string;
  /** Whether that spelling was proven to be a regular file when probed. */
  readonly fileExists: boolean;
}
