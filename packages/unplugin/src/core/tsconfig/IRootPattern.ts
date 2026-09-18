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
  components: readonly (string | { expression: RegExp; wildcard: boolean })[];
  /**
   * Whether this is a `files` entry, which matches one exact path and never a
   * directory prefix.
   */
  literal: boolean;
}
