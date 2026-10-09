/**
 * One compiled root-file specification from a tsconfig's `files` or `include`.
 *
 * `components` holds one matcher per path segment: a literal string, the
 * recursive `**` marker, or compiled literal/wildcard predicates. `literal`
 * marks a `files` entry, which must match a whole path exactly and never a
 * directory prefix.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Literal segments, recursive markers and compiled predicates/tokens represent
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
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Components carry compiled compiler grammar and comparison policy, not
 *   native file identity. The compiler and root-spelling owner select the
 *   filesystem view before producing or consuming this representation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   This representation chooses no traversal or expression execution strategy;
 *   compile and matches own those algorithms.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   The root matcher owns sharing compiled patterns by policy and view;
 *   this value does not establish cache identity or validation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Pattern storage belongs to the root matcher's weak policy cache and
 *   transient consumers; this carrier does not acquire or release resources.
 */
export interface IRootPattern {
  /** Whether segments compare case-sensitively, the compiler's policy. */
  caseSensitive: boolean;

  /**
   * One matcher per path segment: a literal, the recursive `**` marker, or a
   * whole literal expression or bounded wildcard token sequence.
   */
  components: readonly (
    | string
    | {
        /**
         * A whole escaped literal, or wildcard tokens whose expressions match
         * one literal Unicode code point under the compiler's case policy.
         */
        expression: RegExp | readonly ("*" | "?" | RegExp)[];

        /**
         * Whether the segment spells `.min.`, which lets a wildcard file match
         * admit a `.min.js` file TypeScript-Go otherwise leaves out.
         */
        mentionsMin: boolean;

        /** Whether `*` or `?` activates include-only package and file rules. */
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
