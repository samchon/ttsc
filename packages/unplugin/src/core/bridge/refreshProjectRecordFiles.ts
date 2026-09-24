import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../transform/filesystem/TtscTransformFilesystemOperations";
import type { HostWatchBridge } from "./HostWatchBridge";
import { PROJECT_RECORD_DIRECTORY } from "./PROJECT_RECORD_DIRECTORY";
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
 * It costs one proof per record, paid once per build start instead of once per
 * module. A tool directory with no records costs one failed listing.
 *
 * @param toolDirectory The host's tool directory (`hostToolDirectory`).
 * @param bridge The watching session's bridge, when the host has one.
 */
export function refreshProjectRecordFiles(
  toolDirectory: string,
  bridge?: HostWatchBridge,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): void {
  const directory = path.join(toolDirectory, PROJECT_RECORD_DIRECTORY);
  let names: string[];
  try {
    names = fs.readdirSync(directory);
  } catch {
    return;
  }
  for (const name of names) {
    if (name.endsWith(".json"))
      refreshProjectRecordFile(path.join(directory, name), bridge, filesystem);
  }
}
