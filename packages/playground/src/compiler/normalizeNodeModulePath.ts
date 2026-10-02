/**
 * Accept either `node_modules/...` or `/node_modules/...` (or backslash
 * variants); reject anything that escapes the node_modules root via `..`.
 *
 * Returns `null` for paths that don't match the expected shape — the caller
 * skips those entries instead of writing them to the MemFS.
 *
 * @evidence contracts/common.md#principled-implementation Separator normalization establishes the virtual namespace, prefix checking restricts writes to node_modules and rejecting parent segments prevents root escape.
 * @evidence contracts/common.md#clear-and-simple-design One path gate returns a normalized key or null; callers own writes and rejection policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The same structural checks apply to every package entry without allowlisting consumers.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain accepted spelling, confinement and null meaning under the documentation skill.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It keeps no state, handle or listener after returning.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A single pass or constant work over its arguments; no algorithm choice scales beyond that.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call serves one request; there is no equivalent work to share across calls.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation Works on in-memory strings and the wasm virtual filesystem; it reaches no native filesystem, path-identity or process boundary.
 */
export function normalizeNodeModulePath(path: string): string | null {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.startsWith("node_modules/")) return null;
  if (normalized.split("/").some((segment) => segment === "..")) return null;
  return normalized;
}
