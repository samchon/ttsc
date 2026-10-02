/**
 * Join a relative path under a base directory, ignoring base when `rel` is
 * absolute.
 *
 * @evidence contracts/common.md#principled-implementation Absolute virtual paths retain their meaning and relative paths receive the configured virtual base; this helper is not a confinement check.
 * @evidence contracts/common.md#clear-and-simple-design A narrow virtual join keeps source mapping independent of host filesystem APIs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Absolute paths are a supported input form rather than a workaround for a particular package.
 * @evidence contracts/common.md#meaningful-documentation Native prose states absolute precedence, with tag separation following the documentation skill.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It keeps no state, handle or listener after returning.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A single pass or constant work over its arguments; no algorithm choice scales beyond that.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call serves one request; there is no equivalent work to share across calls.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation Works on in-memory strings and the wasm virtual filesystem; it reaches no native filesystem, path-identity or process boundary.
 */
export function joinUnder(base: string, rel: string): string {
  if (rel.startsWith("/")) return rel;
  return `${base}/${rel}`;
}
