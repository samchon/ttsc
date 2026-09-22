import crypto from "node:crypto";
import path from "node:path";

import { PROJECT_RECORD_DIRECTORY } from "./PROJECT_RECORD_DIRECTORY";

/**
 * The file below a host's tool directory that carries one project's state for
 * the host (`TtscProjectRecord`).
 *
 * A generation compiles the whole project, so a module's output depends on the
 * project's state and on nothing finer. Every host is therefore asked to watch
 * exactly two files per module: the module itself, which it watches by nature,
 * and this one. Its content moves when the state does, and the host's own
 * channel, watcher or persistent-cache snapshot, hears the move the way it
 * hears any file. Nothing else is registered: not the compiler's inputs, whose
 * number, kind, and place each host's channels observe imprecisely or refuse,
 * and whose flaws the adapter used to measure and compensate host by host.
 *
 * Its name is the tsconfig's path digested, so two projects below one host root
 * keep two files.
 *
 * @param toolDirectory The host's tool directory (`hostToolDirectory`).
 * @param tsconfig The project's tsconfig, as the adapter names it.
 */
export function projectRecordFile(
  toolDirectory: string,
  tsconfig: string,
): string {
  const name = crypto
    .createHash("sha256")
    .update(path.resolve(tsconfig))
    .digest("hex")
    .slice(0, 32);
  return path.join(toolDirectory, PROJECT_RECORD_DIRECTORY, `${name}.json`);
}
