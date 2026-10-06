import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { TRANSFORM_CACHE_FILESYSTEM } from "./TRANSFORM_CACHE_FILESYSTEM";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Create an empty persistent transform cache with isolated filesystem reads.
 *
 * The default raw directory capability lists byte names and classifies each
 * Buffer child path with non-following lstat. This avoids assuming that every
 * runtime implements raw withFileTypes entries as Node Dirents. Listing or
 * classification errors still reach the proof consumer. Calling the capability
 * costs one listing and one lstat per entry; cache construction does not perform
 * those queries. Explicit overrides and unavailable capabilities stay intact.
 *
 * @evidence contracts/common.md#principled-implementation Each cache receives its own filesystem operation table, so supplied capabilities govern that cache without changing defaults for other adapters. Its default raw directory operation combines native byte names with non-following lstat kinds rather than assuming a runtime-specific raw Dirent representation.
 * @evidence contracts/common.md#clear-and-simple-design A Map stores compile promises and a WeakMap stores its operation table; omitted operations independently use the native defaults. Raw directory and link reads also reach the table; explicitly supplied undefined for these optional capabilities preserves unsupported authority rather than enabling a native fallback. One private native adapter owns raw name/kind normalization; predicate encoding remains in its consumer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit dependency injection supplies filesystem capabilities without replacing foreign methods or adding test-specific behavior. Native predicate replay receives the caller's raw directory/link functions; an explicitly unavailable optional function remains unavailable. The default adapter does not decode names, infer kinds, replace failed observations or recognize fixture inputs.
 * @evidence contracts/common.md#meaningful-documentation The comment describes the empty cache and isolated reads; the parameter type distinguishes required native defaults from optional watch and case-policy capabilities. Native paragraphs also distinguish the raw backend's deferred listing/classification cost and error propagation from construction.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   One fixed capability table follows the cache through a weak association;
 *   supplied functions may retain caller-owned state. Map entries grow with
 *   configuration keys without a factory-imposed capacity.
 *   The default raw callback returns caller-owned entry/stat closures with
 *   storage proportional to the observed entries and name bytes; synchronous
 *   filesystem calls release their handles before returning. The cache owner
 *   removes generations through eviction/reset and their disposer attempts
 *   watcher/probe cleanup; creation acquires no independent native handle.
 * @evidence contracts/performance.md#efficient-algorithms Construction allocates one Map and one fixed operation table. Calling its default raw directory callback performs one listing and one lstat per entry, O(n) native queries and O(total name bytes plus n) retained entry data; predicate sorting remains in the consumer.
 * @evidence contracts/performance.md#reuse-equivalent-work Creates a new cache by definition; sharing one between adapters is decided by sharedBuildTransformCache. The default raw callback observes current membership and kind on each call and adds no independently retained directory memo.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Supplied read and identity capabilities override native defaults per field;
 *   case/platform policy and watch remain optional capabilities for consumers.
 *   The constructor copies references without changing global Node operations
 *   or guessing native case/notification authority from an OS name. Callers
 *   supplying a mixed view remain responsible for coherent observations. The
 *   default raw adapter resolves the directory before joining native Buffer
 *   child paths, preserving drive-relative coordinates without decoding names;
 *   lstat distinguishes links from their targets and readlink retains bytes.
 */
export function createTtscTransformCache(
  /** Optional observing capabilities; omitted required reads use host defaults. */
  operations: Partial<TtscTransformFilesystemOperations> = {},
): TtscTransformCache {
  const cache: TtscTransformCache = new Map();
  TRANSFORM_CACHE_FILESYSTEM.set(cache, {
    caseSensitive: operations.caseSensitive,
    exists: operations.exists ?? DEFAULT_FILESYSTEM_OPERATIONS.exists,
    lstat: operations.lstat ?? DEFAULT_FILESYSTEM_OPERATIONS.lstat,
    readFile: operations.readFile ?? DEFAULT_FILESYSTEM_OPERATIONS.readFile,
    readdir: operations.readdir ?? DEFAULT_FILESYSTEM_OPERATIONS.readdir,
    readlink: Object.hasOwn(operations, "readlink")
      ? operations.readlink
      : DEFAULT_FILESYSTEM_OPERATIONS.readlink,
    readdirRaw: Object.hasOwn(operations, "readdirRaw")
      ? operations.readdirRaw
      : DEFAULT_FILESYSTEM_OPERATIONS.readdirRaw,
    realpath: operations.realpath ?? DEFAULT_FILESYSTEM_OPERATIONS.realpath,
    stat: operations.stat ?? DEFAULT_FILESYSTEM_OPERATIONS.stat,
    statBigInt:
      operations.statBigInt ?? DEFAULT_FILESYSTEM_OPERATIONS.statBigInt,
    platform: operations.platform,
    watch: operations.watch,
  });
  return cache;
}
