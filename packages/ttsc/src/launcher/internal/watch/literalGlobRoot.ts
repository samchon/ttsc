import path from "node:path";

/**
 * The deepest directory of a glob that contains no wildcard: the directory a
 * watcher must observe for the glob's matches to appear.
 *
 * A pattern without any wildcard names one file, so its directory is returned.
 * A wildcard in the first segment yields the volume root.
 *
 * @evidence contracts/common.md#principled-implementation The last separator before the first supported wildcard identifies the deepest literal directory that can contain every match.
 * @evidence contracts/common.md#clear-and-simple-design Resolve, locate the wildcard boundary and preserve the volume root in one direct calculation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The root derives from the declared pattern instead of known project directory names.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain wildcard-free and root-level patterns following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve, dirname and parse preserve Windows drive/UNC roots and POSIX roots; slash normalization is only the supported glob spelling boundary.
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
