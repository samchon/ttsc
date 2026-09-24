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
