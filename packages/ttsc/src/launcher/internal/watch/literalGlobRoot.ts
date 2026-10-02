import path from "node:path";

/**
 * Select the literal directory prefix before a glob's first `*` or `?`.
 *
 * A pattern without any wildcard names one file, so its directory is returned.
 * A wildcard in the first segment after the resolved volume root yields that
 * root; a relative pattern includes its working-directory prefix first.
 * Native resolution anchors relative patterns at the current working directory.
 * Every backslash in the resolved spelling is interpreted as a glob separator;
 * this is lexical glob syntax, not physical identity resolution or preservation
 * of a literal POSIX backslash filename. The topology owner decides whether the
 * selected directory exists and can be observed.
 *
 * @evidence contracts/common.md#principled-implementation The last separator before the first supported wildcard identifies the deepest literal directory that can contain every match.
 * @evidence contracts/common.md#clear-and-simple-design Resolve, locate the wildcard boundary and preserve the volume root in one direct calculation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The root derives from the declared pattern instead of known project directory names.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain wildcard-free and root-level patterns following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native resolve/dirname/parse supply host drive, UNC and POSIX root syntax. Backslash-to-slash conversion expresses the supported glob separator interpretation, not proof that arbitrary physical filename spellings remain unchanged.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Local normalized strings and split arrays are transient; the returned path transfers to the caller. No native descriptor, observer or historical query map is retained, and input text has no quota here.
 * @evidence contracts/performance.md#efficient-algorithms Native path resolution, slash split/join, wildcard/separator scans and possible prefix resolution process supplied spelling plus the current-directory prefix for relative patterns. Temporary text/arrays scale with those lengths, without native stat or descendant enumeration; path length is not bounded by the one-path result.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This lexical selector owns no native observation producer or authority cache to coordinate. Relative results depend on the current working directory and host grammar, so an answer keyed only by the raw pattern would not establish reuse equivalence.
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
