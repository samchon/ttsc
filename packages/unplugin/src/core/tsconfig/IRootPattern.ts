/**
 * One compiled root-file specification from a tsconfig's `files` or `include`.
 *
 * `components` holds one matcher per path segment: a literal string, the
 * recursive `**` marker, or a compiled expression. `literal` marks a `files`
 * entry, which must match a whole path exactly and never a directory prefix.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Literal segments, recursive markers and compiled expressions represent
 *   TypeScript's component grammar; flags preserve case, JSON and exact-file rules.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One compiled value groups grammar and matching policy, keeping the walker
 *   from reconstructing semantics from the original spec at each input.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Its flags encode compiler grammar distinctions rather than fixture-specific
 *   exceptions for filenames that happened to pass.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Member comments explain wildcard min.js and JSON exceptions plus literal
 *   whole-path matching; separate comments preserve each field's meaning.
 */
export interface IRootPattern {
  /** Whether segments compare case-sensitively, the compiler's policy. */
  caseSensitive: boolean;

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
