import fs from "node:fs";
import path from "node:path";

import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";

/**
 * Mark the plugin cache entry holding `binary` as used now, when the binary
 * lives in one.
 *
 * The cache's collector keeps an entry while its last use is recent, and a
 * build or cache hit is what records a use. A long-lived consumer, such as a
 * `ttsc --watch` session reusing its resident check plugins, runs the binary
 * again and again without either, so its entry aged out and could be removed
 * while the session still needed it to respawn a sidecar (samchon/ttsc#1556).
 * The consumer records each cycle's use here instead. A binary outside the
 * cache, whose directory carries no last-use record, is left alone.
 *
 * @param binary The plugin executable being used.
 */
export function touchPluginCacheEntryInUse(binary: string): void {
  const record = path.join(
    path.dirname(binary),
    SourceBuildCacheLayout.CACHE_LAST_USED_FILE,
  );
  try {
    if (!fs.statSync(record).isFile()) return;
    SourceBuildCacheLayout.replaceCacheMetadataFile(record, `${Date.now()}\n`);
  } catch {
    // Not a cache entry, or the record cannot be written: the use goes
    // unrecorded, and a removed binary is rebuilt at the next resolution.
  }
}
