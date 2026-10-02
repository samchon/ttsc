/**
 * Join a relative path under a base directory, ignoring base when `rel` is
 * absolute.
 *
 * @evidence contracts/common.md#principled-implementation Absolute virtual paths retain their meaning and relative paths receive the configured virtual base; this helper is not a confinement check.
 * @evidence contracts/common.md#clear-and-simple-design A narrow virtual join keeps source mapping independent of host filesystem APIs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Absolute paths are a supported input form rather than a workaround for a particular package.
 * @evidence contracts/common.md#meaningful-documentation Native prose states absolute precedence, with tag separation following the documentation skill.
 */
export function joinUnder(base: string, rel: string): string {
  if (rel.startsWith("/")) return rel;
  return `${base}/${rel}`;
}
