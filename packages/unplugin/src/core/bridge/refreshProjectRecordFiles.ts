import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../transform/filesystem/TtscTransformFilesystemOperations";
import type { HostWatchBridge } from "./HostWatchBridge";
import { PROJECT_RECORD_DIRECTORY } from "./PROJECT_RECORD_DIRECTORY";
import { fallbackRecordStorage } from "./fallbackRecordStorage";
import { privateProjectRecordAvailable } from "./privateProjectRecordAvailable";
import { refreshProjectRecordFile } from "./refreshProjectRecordFile";

/**
 * Prove every project record below a host's tool directory against the disk
 * before the host validates anything against its persistent cache
 * (`refreshProjectRecordFile`), or hand each to a watching session's bridge.
 *
 * A host whose own cache restores modules, webpack's, Rspack's, or Farm's, says
 * nothing of which projects it holds, and the instance's own project is no
 * bound: webpack 5's filesystem cache and Rspack 2's persistent cache,
 * measured, restore a module transformed under one `project` in a restart under
 * another (samchon/ttsc#1481). So it proves every record there is. A host whose
 * cache the adapter answers module by module, Rollup's, proves each record as
 * its first module is about to be served instead
 * (`createRollupCachedModuleProof`), and a host that restores nothing proves
 * none.
 *
 * Each call enumerates the directory and refreshes each `.json` name once; host
 * owners invoke it at their restore/start boundaries. A managed inventory
 * qualifies its ancestry before listing. A missing directory or a readable
 * empty directory has no records to replay. If a stale managed record needs
 * invalidation, startup requires the signal or removal to complete.
 *
 * @param toolDirectory The host's tool directory (`hostToolDirectory`).
 * @param bridge The watching session's bridge, when the host has one.
 * @throws When managed records cannot be enumerated or safely refreshed.
 * @evidence contracts/common.md#principled-implementation
 *   Every persisted project record is refreshed because an opaque host cache can
 *   restore projects other than the current option's project. Absent directories
 *   contain no records and need no fabricated state.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One directory enumeration delegates each record's proof/effect lifecycle to
 *   refreshProjectRecordFile without repeating its watcher or deletion policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The .json extension is the record format; selection does not special-case
 *   current-project names that could hide other persistent-cache dependencies.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain complete inventory and per-build proof cost,
 *   with parameter/tag separation following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native ancestry proof checks managed paths before listing. Managed access or update failures prevent opaque restoration; ordinary host paths keep their existing refresh policy.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Native listing allocates N directory names; suffix tests scan their text
 *   and selected .json names pay path joins and delegated record parse/replay,
 *   clock/input/observer/walk/digest costs. The inventory includes non-record
 *   entries and has no per-directory entry cap; opaque host caches require all
 *   selected record names rather than only the current options' project.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Host restore/start owners coordinate project-granularity refresh rather
 *   than per-module replay. This inventory has no cross-call verdict memo;
 *   the supplied bridge owns later qualified observer sharing.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This synchronous inventory retains only a call-local name array; the bridge and per-record refresh own transferred registrations and record deletion.
 */
export function refreshProjectRecordFiles(
  toolDirectory: string,
  bridge?: HostWatchBridge,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  compilerArgumentsIdentity?: string,
  privateStorage = false,
): void {
  const directory = path.join(toolDirectory, PROJECT_RECORD_DIRECTORY);
  const unsafe = () =>
    new Error(
      `@ttsc/unplugin: unsafe private project records prevent cache restoration: ${directory}`,
    );
  if (privateStorage) {
    const inventory = fallbackRecordStorage.inventory(directory);
    if (inventory === "missing") return;
    if (inventory === "blocked") throw unsafe();
  }
  let names: string[];
  try {
    names = fs.readdirSync(directory);
  } catch (error) {
    if (privateStorage)
      throw new Error(
        `@ttsc/unplugin: cannot inspect private project records before cache restoration: ${directory}`,
        { cause: error },
      );
    return;
  }
  const records = names
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(directory, name));
  if (
    privateStorage &&
    records.length !== 0 &&
    (fallbackRecordStorage(directory, false) !== true ||
      records.some((file) => !privateProjectRecordAvailable(file)))
  )
    throw unsafe();
  for (const file of records) {
    refreshProjectRecordFile(
      file,
      bridge,
      filesystem,
      compilerArgumentsIdentity,
      privateStorage,
      privateStorage,
      true,
    );
  }
}
