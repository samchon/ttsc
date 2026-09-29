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
 *
 * @evidence contracts/common.md#principled-implementation
 *   A resolved-tsconfig digest identifies the project within one host tool root;
 *   the deterministic filename persists across processes that restore host caches.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Naming is centralized independently of record writing and state validation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The product-owned directory and extension define the record format; hashing
 *   selects project names without a consumer-specific filename table.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain project-granularity dependency ownership and stable
 *   filename purpose, with parameter/tag separation per documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native resolution and joining preserve the process's actual tsconfig volume and host directory spelling; case policy is not guessed, so distinct lexical spellings can name separate records rather than falsely merging projects.
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
