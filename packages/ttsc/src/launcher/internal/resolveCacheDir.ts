import path from "node:path";

/**
 * Resolve a user-supplied `--cache-dir` value into an absolute path.
 *
 * When `cacheDir` is absent or empty, returns `undefined` so callers fall
 * through to the `TTSC_CACHE_DIR` environment variable and the workspace-local
 * default handled by the shared source-build cache resolver. When `cacheDir` is
 * already absolute it is returned unchanged; otherwise it is resolved relative
 * to `cwd`.
 *
 * @evidence contracts/common.md#principled-implementation Empty input preserves downstream cache precedence, absolute paths retain their spelling and relative paths are anchored to the invocation directory using native path resolution.
 * @evidence contracts/common.md#clear-and-simple-design This helper resolves only the CLI option; environment and workspace-default selection remain with the source-build cache owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No consumer-specific cache directory or guessed home path replaces a caller's option or the downstream cache policy.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain absent/empty meaning, invocation-relative anchoring and the downstream precedence boundary, with acknowledgments separated from prose.
 * @evidence contracts/portability.md#os-neutral-implementation Node's native isAbsolute/resolve determine host path semantics without manual slash conversion, case folding or shell expansion.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The selected or resolved string returns to the caller; this helper retains no path history, cache entry, handle or task.
 * @evidence contracts/performance.md#efficient-algorithms Native absolute-path classification and relative resolution inspect path text without walking directories or probing cache contents. Relative resolution allocates only its current path intermediates/result; an already absolute spelling returns unchanged.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each query selects one invocation option against its supplied cwd; it coordinates no producer computation or retained reusable path answer.
 */
export function resolveCacheDir(
  cwd: string,
  cacheDir?: string,
): string | undefined {
  if (!cacheDir) {
    return undefined;
  }
  return path.isAbsolute(cacheDir) ? cacheDir : path.resolve(cwd, cacheDir);
}
