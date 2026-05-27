/**
 * Accept either `node_modules/...` or `/node_modules/...` (or backslash
 * variants); reject anything that escapes the node_modules root via `..`.
 *
 * Returns `null` for paths that don't match the expected shape — the caller
 * skips those entries instead of writing them to the MemFS.
 */
export function normalizeNodeModulePath(path: string): string | null {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.startsWith("node_modules/")) return null;
  if (normalized.split("/").some((segment) => segment === "..")) return null;
  return normalized;
}
