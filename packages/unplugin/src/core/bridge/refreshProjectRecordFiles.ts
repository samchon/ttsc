import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../transform/filesystem/TtscTransformFilesystemOperations";
import type { HostWatchBridge } from "./HostWatchBridge";
import { PROJECT_RECORD_DIRECTORY } from "./PROJECT_RECORD_DIRECTORY";
import { projectRecordMoved } from "./projectRecordMoved";
import { projectRecordWatchInputs } from "./projectRecordWatchInputs";
import { readProjectRecordFile } from "./readProjectRecordFile";
import { signalProjectRecordFile } from "./signalProjectRecordFile";

/**
 * Prove every project record below a host's tool directory against the disk
 * before the host validates anything against its persistent cache, and move the
 * record of a project whose state changed while nothing ran.
 *
 * A host restoring a module from its cache never runs the adapter for it, so
 * the adapter cannot learn at delivery that an input moved, a root file
 * appeared, or a tsconfig vanished while the host was stopped. It learns here:
 * each recorded input is proven against the disk the way a delivery proves it
 * (`watchInputEvidenceMatchesDisk`), and the walk is run again under the
 * recorded policy and its digest compared. One mismatch moves the record
 * (`signalProjectRecordFile`); the host, which recorded the file as a
 * dependency of every module of the project, runs those modules again, and
 * their deliveries write the record of the generation that read the change. A
 * record that cannot be read proves nothing and is moved too. A record whose
 * tsconfig is gone is removed instead, the one move no delivery has to end.
 *
 * A watching host's bridge, opened for its first pass, takes every record
 * instead (`projectRecordWatchInputs`): the bridge proves the recorded inputs
 * as it takes them, moves a record it finds stale and again until a delivery
 * answers, and observes them from then on. A project the host restored whole
 * from its cache has no delivery in this process to register it, and an input
 * of it edited while the host runs would otherwise be heard by nothing.
 *
 * This is the same proof a delivery makes of a generation, paid once per build
 * start instead of once per module, and it costs what the host's own snapshot
 * costs: one read per recorded input and one listing per project directory. A
 * tool directory with no records costs one failed listing.
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
    if (!name.endsWith(".json")) continue;
    const file = path.join(directory, name);
    const record = readProjectRecordFile(file);
    // A record that cannot be read proves nothing, and is moved as a proof
    // that found a change is. A host may hold exactly these bytes: a signal
    // that could not read the record writes a bare one
    // (`signalProjectRecordFile`), the host runs the project's modules on that
    // move, and a delivery of a generation its process already recorded hands
    // the file over without writing it again, so the host's cache ends up
    // recording bytes no proof can run over. Only a move here runs those
    // modules again, whose deliveries write the record whole. A writer caught
    // mid-write loses its bytes to the move, which its own host hears and
    // runs on, and a record another process removed stays removed.
    if (record === undefined) {
      signalProjectRecordFile(file);
      continue;
    }
    // Nothing will write this project again: the record's own rule, that it
    // keeps moving until a delivery writes the state a proof found, has no
    // delivery left to end it, and a build start would rewrite it forever.
    // Removing it is the move, which every host hears as the dependency it
    // holds going away, and it ends there.
    if (!fs.existsSync(record.tsconfig)) {
      try {
        fs.rmSync(file, { force: true });
      } catch {
        // Held by another process; the next start removes it.
      }
      continue;
    }
    if (bridge !== undefined) {
      bridge.register(file, projectRecordWatchInputs(record));
      continue;
    }
    // A proof that cannot run proves nothing, and the record is moved as if
    // it had found a change: the host then runs the modules, whose
    // deliveries write a record the next proof can run over.
    let moved: string | undefined;
    try {
      moved = projectRecordMoved(record, filesystem);
    } catch {
      moved = record.root;
    }
    if (moved !== undefined) signalProjectRecordFile(file);
  }
}
