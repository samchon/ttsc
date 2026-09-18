/**
 * One compiled root-file specification from a tsconfig's `files` or `include`.
 *
 * `components` holds one matcher per path segment: a literal string, the
 * recursive `**` marker, or a compiled expression. `literal` marks a `files`
 * entry, which must match a whole path exactly and never a directory prefix.
 */
export interface IRootPattern {
  components: readonly (string | { expression: RegExp; wildcard: boolean })[];
  literal: boolean;
}
