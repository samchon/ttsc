import fs from "node:fs";
import path from "node:path";

import { farmRecordFallback } from "./farmRecordFallback";

/**
 * Disable Farm's persistent cache when a same-volume project record is
 * unavailable. Farm ignores node_modules watch dependencies and has no
 * per-module persistent-cache switch. Without a record, an edit made while Farm
 * was stopped could leave an old transformed module in its cache.
 *
 * @evidence contracts/common.md#principled-implementation The configuration hook keeps persistent caching only when the existing private fallback can host an ordinary record directory on Farm's volume; a later write retains its own error handling.
 * @evidence contracts/common.md#clear-and-simple-design One root and fallback query decide whether to copy the config with persistentCache disabled.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No probe file or nonignored project directory is created to test the candidate.
 * @evidence contracts/common.md#meaningful-documentation The comment explains the host limitation, invalidation failure and configuration-level fallback.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and filesystem access checks observe the candidate under the host's selected root and platform permissions.
 * @evidence contracts/performance.md#efficient-algorithms At most one ancestor walk observes existing fallback components; the disabled case copies the configuration's own properties.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Writability is observed afresh on each configuration pass.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The warning set retains one spelling per refused root for the process lifetime. No probe file or handle is retained.
 */
export function farmPersistentCacheWithoutRecords<
  Config extends {
    compilation?: { persistentCache?: unknown };
    root?: string;
  },
>(config: Config, cwd: string): Config {
  if (config.compilation?.persistentCache === false) return config;
  const root = path.resolve(cwd, config.root ?? ".");
  const fallback = farmRecordFallback(root);
  if (fallback !== undefined && canHostRecords(fallback)) return config;
  if (!WARNED.has(root)) {
    WARNED.add(root);
    process.emitWarning(
      `@ttsc/unplugin: Farm's persistent cache is off for ${root}. ` +
        "No writable same-volume directory can hold its project records.",
      { code: "TTSC_PROJECT_RECORD_UNWRITABLE" },
    );
  }
  return {
    ...config,
    compilation: { ...config.compilation, persistentCache: false },
  };
}

/** Check the first existing fallback ancestor without creating a probe. */
function canHostRecords(fallback: string): boolean {
  for (let directory = fallback; ; directory = path.dirname(directory)) {
    try {
      const stat = fs.lstatSync(directory, { throwIfNoEntry: false });
      if (stat !== undefined) {
        if (!stat.isDirectory()) return false;
        fs.accessSync(directory, fs.constants.W_OK);
        return true;
      }
    } catch {
      return false;
    }
    if (path.dirname(directory) === directory) return false;
  }
}

/** The host roots this process already warned about. */
const WARNED = new Set<string>();
