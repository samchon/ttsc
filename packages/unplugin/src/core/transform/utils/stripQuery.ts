/**
 * Strip a query string or hash fragment from a bundler module id.
 *
 * Hosts append query parameters to differentiate import variants of the same
 * file, such as Vite's `?t=` cache busting. They must be stripped before the id
 * is used as a filesystem path. A variant that is a host-generated wrapper,
 * such as `?raw`, is never transformed at all; see `isHostWrapperQuery`.
 */
export function stripQuery(id: string): string {
  const query = id.search(/[?#]/);
  return query === -1 ? id : id.slice(0, query);
}
