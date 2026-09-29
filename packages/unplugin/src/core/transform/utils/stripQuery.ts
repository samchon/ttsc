/**
 * Strip a query string or hash fragment from a bundler module id.
 *
 * Hosts append query parameters to differentiate import variants of the same
 * file, such as Vite's `?t=` cache busting. They must be stripped before the id
 * is used as a filesystem path. A variant that is a host-generated wrapper,
 * such as `?raw`, is never transformed at all; see `isHostWrapperQuery`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Slicing at the first query/fragment delimiter preserves the file spelling
 *   preceding bundler metadata; no delimiter leaves the original id unchanged.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper strips syntax only; wrapper rejection stays with its classifier.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Query and fragment delimiters are module-id syntax, not consumer exceptions.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains filesystem use and the distinct wrapper policy using separate
 *   prose and tags, following documentation guidance.
 */
export function stripQuery(id: string): string {
  const query = id.search(/[?#]/);
  return query === -1 ? id : id.slice(0, query);
}
