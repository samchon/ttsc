import path from "node:path";

import { hostToolDirectory } from "../bridge/hostToolDirectory";
import { projectRecordDirectoryWritable } from "../bridge/projectRecordDirectoryWritable";
import { farmRecordFallback } from "./farmRecordFallback";

/**
 * Farm's configuration with its persistent cache turned off when no project
 * record could be written anywhere Farm accepts one, or the configuration
 * unchanged (samchon/ttsc#1480).
 *
 * A module handed to a host without its project's record depends on its own
 * bytes alone, and the adapter marks it uncacheable where the host allows that.
 * Farm offers a JavaScript plugin no per-module opt-out of its persistent
 * cache, so after a type-only edit made while Farm was stopped, it restored
 * such a module and served its old output. Its `config` hook can turn the cache
 * off for the whole compile, measured on Farm 1.7.11: a module Farm restores on
 * the second compile of a browser target ran its transform again, and no store
 * was written. So Farm is asked here, before any delivery, whether its records
 * will exist: below its root (`hostToolDirectory`), or in the fallback it
 * accepts (`farmRecordFallback`), each tested by a current write. This does not
 * promise later write capability. Where neither can be written persistent cache
 * use is disabled in the returned configuration, and the user is told once why,
 * as a Node process warning, code `TTSC_PROJECT_RECORD_UNWRITABLE`.
 *
 * @param config Farm's user configuration, as its `config` hook receives it.
 * @param cwd The directory Farm runs in, the root when the configuration names
 *   none.
 * @evidence contracts/common.md#principled-implementation Current record-directory probes select whether Farm is asked to retain persistent modules; when both fail the returned config disables that cache. Later writes still need delivery-time failure handling, so a successful probe is not lifetime invalidation authority.
 * @evidence contracts/common.md#clear-and-simple-design The configuration hook probes the two existing record locations and returns a shallow config/compilation copy changing persistentCache when needed. Other own enumerable fields and shared nested values are preserved.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This is a host capability boundary with a stated invalidation reason, rather than a test-only bypass, patched cache implementation, or assumed writable directory.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why per-module opt-out is unavailable and why the warning and configuration-level fallback are necessary.
 * @evidence contracts/portability.md#os-neutral-implementation Writability is proven by an actual write below the tool directory and the fallback, and the root is resolved with path.resolve against cwd, so no operating-system name, permission bit or drive layout is assumed.
 * @evidence contracts/performance.md#efficient-algorithms
 *   At most two write probes retain native path/mkdir/write/removal work and
 *   delegated fallback naming/trust setup. Warning text follows path length;
 *   disabling cache copies the config/compilation own fields. A fixed probe
 *   count does not make native operations or field populations constant cost.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The WARNED set emits the unwritable-records warning once per tool
 *   directory spelling, not once per config pass. It marks before emission,
 *   so it suppresses later attempts rather than certifying user receipt. Write
 *   capability is still freshly probed instead of reused from that warning key.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   WARNED retains each distinct tool-directory spelling for the process life,
 *   without eviction or a fixed string-byte bound. Probe cleanup and persistent
 *   directories belong to the write-probe helper; failed removal can leave its
 *   probe. Returned config ownership transfers to Farm.
 */
export function farmPersistentCacheWithoutRecords<
  Config extends {
    compilation?: { persistentCache?: unknown };
    root?: string;
  },
>(config: Config, cwd: string): Config {
  if (config.compilation?.persistentCache === false) return config;
  const root = path.resolve(cwd, config.root ?? ".");
  const toolDirectory = hostToolDirectory(root);
  if (projectRecordDirectoryWritable(toolDirectory)) return config;
  const fallback = farmRecordFallback(root);
  if (fallback !== undefined && projectRecordDirectoryWritable(fallback)) {
    return config;
  }
  if (!WARNED.has(toolDirectory)) {
    WARNED.add(toolDirectory);
    process.emitWarning(
      `@ttsc/unplugin: project records cannot be written below ` +
        `${toolDirectory}, nor anywhere else Farm accepts them, so Farm's ` +
        "persistent cache is turned off: it would restore a module whatever " +
        "the types its output consulted did while Farm was stopped. Let the " +
        `adapter write below ${toolDirectory}.`,
      { code: "TTSC_PROJECT_RECORD_UNWRITABLE" },
    );
  }
  return {
    ...config,
    compilation: { ...config.compilation, persistentCache: false },
  };
}

/** The tool directories this process already warned about. */
const WARNED = new Set<string>();
