import fs from "node:fs";
import path from "node:path";

import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";

/**
 * Mark the plugin cache entry holding `binary` as used now, when the binary
 * lives in one.
 *
 * The cache's collector considers recent use when selecting its protected byte
 * cohort; freshness is not an unconditional pin. A build or cache hit records a
 * use. A long-lived consumer, such as a `ttsc --watch` session reusing its
 * resident check plugins, runs the binary again and again without either, so
 * its entry aged out and could be removed while the session still needed it to
 * respawn a sidecar. The consumer records each cycle's use
 * here instead. This improves its recency priority but does not give it
 * ownership of a permanently retained binary. A binary outside the cache, whose
 * directory carries no last-use record, is left alone.
 *
 * @param binary The plugin executable being used.
 *
 * @evidence contracts/common.md#principled-implementation An existing last-use marker identifies a source cache entry; atomic replacement refreshes that entry without changing an aliased old marker inode.
 * @evidence contracts/common.md#clear-and-simple-design The binary's containing entry is projected directly, with a marker-presence gate before publication.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The marker is authored cache provenance, not a filename exception for a particular plugin or consumer.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains resident-use refresh, the absent-marker boundary and tolerated refresh failures.
 * @evidence contracts/portability.md#os-neutral-implementation Native dirname/join and metadata replacement handle platform paths; locked or missing files remain a tolerated refresh failure.
 * @evidence contracts/performance.md#efficient-algorithms A fixed-size timestamp replacement uses a constant number of metadata operations independent of binary bytes.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This helper does not validate the resident binary's build inputs or coordinate its production.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Resident usage refreshes disk-entry last use while the collector owns byte bounds and actual eviction; this operation retains no worker or handle.
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
