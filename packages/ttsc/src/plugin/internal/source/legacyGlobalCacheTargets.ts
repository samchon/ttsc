import os from "node:os";
import path from "node:path";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";

/**
 * Machine-global cache directories created by pre-0.17 ttsc releases (XDG /
 * AppData / Library / `~/.cache`). ttsc no longer writes to any of these, but
 * an upgraded machine can still hold a multi-GB orphaned cache here, so `ttsc
 * clean` offers them for removal to reclaim that disk. Each entry is the whole
 * `<userCacheRoot>/ttsc` directory (both its `plugins` and `go-build`), which
 * was entirely ttsc-owned in those releases and is safe to remove.
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
      roots.add(path.join(home, "AppData", "Local", SourceBuildCacheLayout.TTSC_CACHE_DIRNAME));
    }
  } else if (process.platform === "darwin" && home) {
    roots.add(path.join(home, "Library", "Caches", SourceBuildCacheLayout.TTSC_CACHE_DIRNAME));
  }
  if (home) {
    roots.add(path.join(home, ".cache", SourceBuildCacheLayout.TTSC_CACHE_DIRNAME));
  }
  return [...roots];
}
