import os from "node:os";
import path from "node:path";

import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";

/**
 * Machine-global cache directories created by pre-0.17 ttsc releases (XDG /
 * AppData / Library / `~/.cache`). The current default no longer selects these
 * machine-global roots, though an explicit override can select them. An
 * upgraded machine can still hold a multi-GB orphaned cache here, so `ttsc
 * clean` offers them for removal to reclaim that disk. Each entry is the whole
 * `<userCacheRoot>/ttsc` directory (both its `plugins` and `go-build`), which
 * was ttsc-owned in those releases. The cleanup transaction still validates
 * present-day physical ownership and protected directories before deletion.
 *
 * The same holds for `<os.tmpdir()>/ttsc-orphan`, where releases that
 * lowered orphan sources for every run without
 * `TTSC_CACHE_DIR` and never collected them.
 *
 * @evidence contracts/common.md#principled-implementation The set enumerates historically authored ttsc cache locations, accepting environment cache bases only when absolute.
 * @evidence contracts/common.md#clear-and-simple-design One migration query deduplicates the finite platform-specific candidates without deleting them.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Platform-specific paths represent actual prior layouts, not compensation for a disproven current-root assumption.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes historical roots from the current workspace policy and explains migration cleanup ownership.
 * @evidence contracts/portability.md#os-neutral-implementation os.homedir/tmpdir and native path.join provide host bases; explicit Windows/macOS historical layouts are isolated in this migration boundary and relative environment bases are rejected.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns a fresh array; the Set is local to the call.
 * @evidence contracts/performance.md#efficient-algorithms A fixed candidate count is deduplicated through a call-local Set. Native home/tmp lookup, supplied environment-path text and joined result strings still contribute processing and temporary storage; no directory population is traversed here.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The list is recomputed from the environment on each call and no cache is kept.
 */
export function legacyGlobalCacheTargets(): string[] {
  const roots = new Set<string>();
  const home = os.homedir();
  const xdg = process.env.XDG_CACHE_HOME;
  if (xdg && path.isAbsolute(xdg)) {
    roots.add(path.join(xdg, SourceBuildCacheLayout.TTSC_CACHE_DIRNAME));
  }
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA;
    if (local && path.isAbsolute(local)) {
      roots.add(path.join(local, SourceBuildCacheLayout.TTSC_CACHE_DIRNAME));
    }
    if (home) {
      roots.add(
        path.join(
          home,
          "AppData",
          "Local",
          SourceBuildCacheLayout.TTSC_CACHE_DIRNAME,
        ),
      );
    }
  } else if (process.platform === "darwin" && home) {
    roots.add(
      path.join(
        home,
        "Library",
        "Caches",
        SourceBuildCacheLayout.TTSC_CACHE_DIRNAME,
      ),
    );
  }
  if (home) {
    roots.add(
      path.join(home, ".cache", SourceBuildCacheLayout.TTSC_CACHE_DIRNAME),
    );
  }
  roots.add(path.join(os.tmpdir(), LEGACY_ORPHAN_CACHE_DIRNAME));
  return [...roots];
}

/** The temporary-directory parent of the orphan cache in earlier releases. */
const LEGACY_ORPHAN_CACHE_DIRNAME = "ttsc-orphan";
