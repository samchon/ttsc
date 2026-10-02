import fs from "node:fs";
import path from "node:path";

import { SourceBuildCacheLayout } from "../../../plugin/internal/source/SourceBuildCacheLayout";
import { resolveSourceBuildCachePaths } from "../../../plugin/internal/source/resolveSourceBuildCachePaths";

/**
 * Whether the compiler ttsc runs for a project compares file names
 * case-sensitively, answered before that compiler has run.
 *
 * TypeScript-Go decides it once, from the executable it runs as
 * (`internal/vfs/osvfs/os.go`, `isFileSystemCaseSensitive`):
 *
 * - On Windows, never;
 * - Elsewhere, unless `os.Executable()` is found again under its case-swapped
 *   spelling, every letter's case flipped (`swapCase`); a missing swapped path
 *   means sensitive, and any other failure stops the compiler.
 *
 * The executable of a compile ttsc runs, its compiler host or a plugin host,
 * lives at `<plugin cache root>/<key>/plugin`, below the root the project
 * resolves (`--cache-dir`, `TTSC_CACHE_DIR`, or the default project-local
 * root). The root is created the way the build creates it and probed at its
 * physical path, the spelling `os.Executable()` reads on Linux and the one the
 * build spawns from a default root. The key directory and the binary are made
 * inside that root by ttsc, so a name there is looked up as the root is. On
 * darwin, where `os.Executable()` is the spawned spelling, an explicit root
 * spelled through a link onto a volume of the other case policy is answered for
 * its target, not for the spelling the compiler sees.
 *
 * A failure other than a missing swapped path is one the compiler would not
 * survive, so the answer is insensitive, which matches every spelling.
 *
 * @param props.projectRoot The project the compile runs for.
 * @param props.cacheDir The cache directory the compile is given, if any.
 * @param props.env The compile's environment.
 *
 * @evidence contracts/common.md#principled-implementation The Windows return matches the pinned compiler's explicit policy; other hosts probe the physical plugin-cache root's swapped spelling as a proxy for the executable placed beneath it, with the documented Darwin lexical-path limitation.
 * @evidence contracts/common.md#clear-and-simple-design Cache-root selection stays with SourceBuildCacheLayout while this boundary owns the compiler case-policy approximation and swapCase owns Unicode spelling conversion.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The platform branch expresses actual upstream compiler behavior rather than a generic filesystem assumption; unreadable probes conservatively admit more spellings instead of inventing a known project answer.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the upstream probe, physical-root premise, Darwin limitation and error fallback; params describe compile context and tags are visibly separated.
 * @evidence contracts/portability.md#os-neutral-implementation Code uses native mkdir/realpath/stat and probes the selected cache volume rather than guessing its policy from OS names; the Windows special case intentionally mirrors the compiler, and the Darwin symlink spelling limitation is explicit.
 * @evidence contracts/performance.md#efficient-algorithms A cache-root lookup performs bounded path setup and one swapped-path stat; Unicode transformation is linear in the root spelling length with no directory traversal.
 * @evidence contracts/performance.md#reuse-equivalent-work Answers share the physical plugin-root key under the compiler's fixed case-policy premise; native case-policy changes during the process are not revalidated and remain a documented limitation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The process owns one boolean per distinct physical plugin-cache root; there is no eviction bound, so historical root cardinality grows until process exit, while the probe retains no descriptor.
 */
export function compilerUsesCaseSensitiveFileNames(props: {
  /** Explicit cache root; absence uses environment or workspace-local selection. */
  cacheDir?: string;

  /** Compile environment; absence uses the current process environment. */
  env?: NodeJS.ProcessEnv;

  /** Project directory used for workspace-local cache placement. */
  projectRoot: string;
}): boolean {
  if (process.platform === "win32") return false;
  const env = props.env ?? process.env;
  let root: string;
  try {
    const paths = resolveSourceBuildCachePaths(
      path.resolve(props.projectRoot),
      props.cacheDir,
      env,
    );
    if (!props.cacheDir && !env.TTSC_CACHE_DIR) {
      SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot(paths.root);
      root = SourceBuildCacheLayout.canonicalPluginCacheRoot(paths.pluginRoot);
    } else {
      fs.mkdirSync(paths.pluginRoot, { recursive: true });
      root = fs.realpathSync.native(paths.pluginRoot);
    }
  } catch {
    return false;
  }
  const cached = ANSWERS.get(root);
  if (cached !== undefined) return cached;
  let answer: boolean;
  try {
    fs.statSync(swapCase(root));
    answer = false;
  } catch (error) {
    answer = (error as NodeJS.ErrnoException).code === "ENOENT";
  }
  ANSWERS.set(root, answer);
  return answer;
}

/** Answers by physical plugin cache root, fixed like the compiler's own. */
const ANSWERS = new Map<string, boolean>();

/**
 * Flip the case of every character, as TypeScript-Go's `swapCase` does: a
 * character with an upper-case form takes it, and any other takes its
 * lower-case form.
 *
 * Go uses the simple case mappings, one character to one, and JavaScript
 * exposes only the full ones. They differ where a full mapping expands to
 * several characters: `ß` has no simple upper-case form in either, but `İ`
 * (U+0130) lower-cases to `i` in Go, and the Greek letters with ypogegrammeni
 * upper-case to their title-case forms. Such a character is kept as it is here.
 * A kept character is the path's own, so this swapped path is found whenever
 * Go's is: the answer can differ only by being insensitive where the compiler
 * says sensitive, and a host then matches more spellings than the compiler
 * does, never fewer.
 *
 * This private helper owns only spelling conversion. The caller owns native
 * filesystem interpretation and caches established root answers. One code-point
 * pass uses space proportional to the spelling and retains no historical
 * paths.
 */
function swapCase(text: string): string {
  let output = "";
  for (const character of text) {
    const upper = character.toUpperCase();
    if (upper !== character && [...upper].length === 1) {
      output += upper;
      continue;
    }
    const lower = character.toLowerCase();
    output += [...lower].length === 1 ? lower : character;
  }
  return output;
}
