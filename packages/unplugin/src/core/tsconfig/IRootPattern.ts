/**
 * One compiled root-file specification from a tsconfig's `files` or `include`.
 *
 * `components` holds one matcher per path segment: a literal string, the
 * recursive `**` marker, or a compiled expression. `literal` marks a `files`
 * entry, which must match a whole path exactly and never a directory prefix.
 */
export interface IRootPattern {
  /**
   * One matcher per path segment: a literal, the recursive `**` marker, or a
   * compiled expression.
   */
  components: readonly (
    | string
    | {
        expression: RegExp;
        /**
         * Whether the segment spells `.min.`, which lets a wildcard file match
         * admit a `.min.js` file TypeScript-Go otherwise leaves out.
         */
        mentionsMin: boolean;
        wildcard: boolean;
      }
  )[];
  /**
   * Whether the spec can admit a `.json` root file: a `files` entry, or an
   * `include` spec that itself ends in `.json`. TypeScript-Go matches every
   * other include against JSON files and then discards them
   * (`getFileNamesFromConfigSpecs`).
   */
  json: boolean;
  /**
   * Whether this is a `files` entry, which matches one exact path and never a
   * directory prefix.
   */
  literal: boolean;
}
