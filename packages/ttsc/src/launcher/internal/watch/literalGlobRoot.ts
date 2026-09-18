import path from "node:path";

/**
 * The deepest directory of a glob that contains no wildcard: the directory a
 * watcher must observe for the glob's matches to appear.
 *
 * A pattern without any wildcard names one file, so its directory is returned.
 * A wildcard in the first segment yields the volume root.
 */
export function literalGlobRoot(pattern: string): string {
  const resolved = path.resolve(pattern);
  const normalized = resolved.split("\\").join("/");
  const wildcard = normalized.search(/[*?]/);
  if (wildcard === -1) return path.dirname(resolved);
  const separator = normalized.lastIndexOf("/", wildcard);
  const prefix = separator < 0 ? "." : normalized.slice(0, separator);
  const volumeRoot = path.parse(resolved).root;
  const normalizedVolumeRoot = volumeRoot.split("\\").join("/");
  if (
    prefix.length === 0 ||
    prefix === normalizedVolumeRoot.replace(/\/$/, "")
  ) {
    return volumeRoot;
  }
  return path.resolve(prefix);
}
