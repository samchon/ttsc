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
 * accepts (`farmRecordFallback`), each proven by a write. Where neither can be
 * written the cache is turned off, which costs a full compile per start, and
 * the user is told once why, as a Node process warning, code
 * `TTSC_PROJECT_RECORD_UNWRITABLE`.
 *
 * @param config Farm's user configuration, as its `config` hook receives it.
 * @param cwd The directory Farm runs in, the root when the configuration names
 *   none.
 *
 * @evidence contracts/common.md#principled-implementation Farm may retain transformed modules only when a writable project record can carry compiler-input invalidation; absent that capability, disabling its whole persistent cache preserves freshness.
 * @evidence contracts/common.md#clear-and-simple-design The configuration hook probes the two existing record locations and changes only persistentCache, preserving unrelated user configuration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This is a host capability boundary with a stated invalidation reason, rather than a test-only bypass, patched cache implementation, or assumed writable directory.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why per-module opt-out is unavailable and why the warning and configuration-level fallback are necessary.
 * @evidence contracts/portability.md#os-neutral-implementation Writability is proven by an actual write below the tool directory and the fallback, and the root is resolved with path.resolve against cwd, so no operating-system name, permission bit or drive layout is assumed.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop of its own; it probes at most two record directories.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The WARNED set emits the unwritable-records warning once per tool
 *   directory, not once per config pass.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   WARNED keeps one short string per tool directory for the process life;
 *   the number of distinct Farm roots bounds it.
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
