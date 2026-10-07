import crypto from "node:crypto";
import path from "node:path";

import { PROJECT_RECORD_DIRECTORY } from "./PROJECT_RECORD_DIRECTORY";

/**
 * The file below a host's tool directory that carries one project's state for
 * the host (`TtscProjectRecord`).
 *
 * A generation compiles the whole project, so a module's output depends on the
 * recorded project state. Adapters request a coarse project-record dependency
 * alongside the module itself when their host channel and record writer permit
 * it. The host's watcher or persistent-cache snapshot observes that file
 * through its ordinary dependency channel; naming alone guarantees neither
 * delivery writes nor host receipt. This channel registers the project record
 * rather than the compiler's individual inputs, whose number, kind, and place
 * each host's channels observe imprecisely or refuse, and whose flaws the
 * adapter used to measure and compensate host by host.
 *
 * Its name is the resolved lexical tsconfig path's truncated digest. Distinct
 * spellings may name distinct records even for one physical config; separation
 * of different projects relies on digest collision resistance.
 *
 * @param toolDirectory The host's tool directory (`hostToolDirectory`).
 * @param tsconfig The project's tsconfig, as the adapter names it.
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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing; it only names a file that the record writers create.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Native resolution, SHA-256 and directory join process the tsconfig/tool-root
 *   text and allocate the returned spelling. This naming performs no native IO
 *   or project enumeration; the digest is recomputed for each call.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The name is recomputed from the tsconfig path on every call; no computation is shared.
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
