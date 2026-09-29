/**
 * The query keys whose module is a host-generated wrapper around a source file,
 * not the file's program text (samchon/ttsc#1394).
 *
 * Vite answers `?raw` with the file's text as a string, `?url` with an asset
 * URL, `?inline` and `?no-inline` with an inlined or emitted asset, and
 * `?worker` and `?sharedworker` with a worker constructor. webpack and Rspack
 * projects use the same `?raw` and `?url` names for `asset/source` and
 * `asset/resource` rules. Substituting the file's compiled program for any of
 * them changes what the import yields, so they are left to the host.
 *
 * The list is exact on purpose. Every other query still denotes the file's own
 * program module and is transformed: cache busting (`?t=`, `?v=`), `?import`,
 * the worker entry `?worker_file`, and framework route chunks such as React
 * Router's `?route-chunk=`, which splits the code ttsc produced.
 */
const HOST_WRAPPER_QUERY_KEYS: ReadonlySet<string> = new Set([
  "inline",
  "no-inline",
  "raw",
  "sharedworker",
  "url",
  "worker",
]);

/**
 * Whether a module id carries a query that makes its module a host-generated
 * wrapper rather than the file's program text.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Parsed query keys are compared with exact host-wrapper keys; ordinary import
 *   variants remain program text and a fragment is outside the query domain.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One classifier owns wrapper identity; stripping metadata is a separate task.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The constant enumerates supported host module semantics rather than test ids.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose defines wrapper-versus-program ownership and the nearby key
 *   documentation explains the reason, following paragraph/tag guidance.
 */
export function isHostWrapperQuery(id: string): boolean {
  const start = id.indexOf("?");
  const end = id.indexOf("#");
  if (start < 0 || (end >= 0 && end < start)) return false;
  for (const key of new URLSearchParams(
    id.slice(start + 1, end < 0 ? undefined : end),
  ).keys()) {
    if (HOST_WRAPPER_QUERY_KEYS.has(key)) return true;
  }
  return false;
}
