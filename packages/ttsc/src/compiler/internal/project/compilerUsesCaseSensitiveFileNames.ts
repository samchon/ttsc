import fs from "node:fs";
import path from "node:path";

import { SourceBuildCacheLayout } from "../../../plugin/internal/source/SourceBuildCacheLayout";
import { resolveSourceBuildCachePaths } from "../../../plugin/internal/source/resolveSourceBuildCachePaths";

/**
 * Approximate the compiler's file-name case policy before its reported answer
 * is available.
 *
 * TypeScript-Go decides it once, from the executable it runs as
 * (`internal/vfs/osvfs/os.go`, `isFileSystemCaseSensitive`):
 *
 * - On Windows, never; on the upstream WebAssembly host, always;
 * - On other upstream hosts, unless `os.Executable()` is found again under its case-swapped
 *   spelling, every letter's case flipped (`swapCase`); a missing swapped path
 *   means sensitive, and any other failure stops the compiler.
 *
 * This Node helper returns false on Windows. Elsewhere it resolves the project's
 * plugin-cache root (`--cache-dir`, `TTSC_CACHE_DIR`, or the default workspace
 * root), creates it and probes its physical spelling. Source-built compiler and
 * plugin hosts are placed at `<plugin cache root>/<key>/plugin`, but probing the
 * root is a proxy, not observation of their executable. Different directory
 * case policies, lexical symlink spellings and Unicode case mappings can make
 * the proxy disagree. In particular, on Darwin an explicitly linked root is
 * probed at its target rather than the spelling the compiler sees. This helper
 * does not implement the upstream WebAssembly branch or certify an arbitrary
 * selected compiler binary.
 *
 * Cache setup failures and swapped-path errors other than ENOENT return false.
 * That fallback admits more case spellings than a sensitive answer; it does not
 * establish what the actual compiler would report. Consumers can replace the
 * approximation with a reported graph policy and retry membership admission.
 *
 * @param props.projectRoot The project the compile runs for.
 * @param props.cacheDir The cache directory the compile is given, if any.
 * @param props.env The compile's environment.
 *
 * @evidence contracts/common.md#principled-implementation The Windows return matches the pinned compiler's explicit policy; other hosts probe the physical plugin-cache root's swapped spelling as a proxy for the executable placed beneath it, with the documented Darwin lexical-path limitation.
 * @evidence contracts/common.md#clear-and-simple-design Cache-root selection stays with SourceBuildCacheLayout while this boundary owns the compiler case-policy approximation and swapCase owns Unicode spelling conversion.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The platform branch expresses actual upstream compiler behavior rather than a generic filesystem assumption; unreadable probes conservatively admit more spellings instead of inventing a known project answer.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish upstream executable observation from this physical-root proxy, its platform/path/Unicode limitations and false fallback; params describe compile context and tags are visibly separated.
 * @evidence contracts/portability.md#os-neutral-implementation Code uses native mkdir/realpath/stat and probes the selected cache volume rather than guessing its policy from OS names; the Windows special case intentionally mirrors the compiler, and the Darwin symlink spelling limitation is explicit.
 * @evidence contracts/performance.md#efficient-algorithms Windows returns without filesystem work. Every other call resolves cache placement before consulting ANSWERS: default discovery can walk ancestors, read uncapped manifest bytes and snapshot cache-layout entries, followed by marker/root setup and native canonicalization. A cached answer skips only the swapped-spelling conversion and stat. Conversion visits root code points and builds proportional output; native path, metadata and delegated entry work is not bounded by the boolean result.
 * @evidence contracts/performance.md#reuse-equivalent-work Answers share the physical plugin-root key only after placement and root setup repeat; this avoids repeating the case probe, not the delegated discovery. Native case-policy changes during the process are not revalidated, and the root-to-executable approximation remains conditional even for a cached answer.
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
 * The resulting string therefore need not equal Go's swapped string. Whether
 * either spelling resolves is a separate native filesystem observation; this
 * conversion alone does not prove that one probe's answers contain the other's.
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
