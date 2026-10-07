import path from "node:path";

/** The records this process already warned about. */
const WARNED = new Set<string>();

/**
 * Attempt a process warning once per record spelling that a module went to its
 * host without the project's record, because the record could be written
 * neither below the host's root nor anywhere else the host accepts it, and does
 * not exist (samchon/ttsc#1480).
 *
 * A build host watches a module and its record and nothing else, so a module
 * handed over without the record depends on its own bytes alone. The adapter
 * marks such a module uncacheable where the host allows that, so no persistent
 * cache restores it on those bytes, and a watching session refuses to serve it
 * where the host reports that it watches; the warning names the cause with its
 * remedy, as a Node process warning, code `TTSC_PROJECT_RECORD_UNWRITABLE`.
 *
 * @param record The record that could not be written below the host's root.
 * @param error What the write failed with.
 * @evidence contracts/common.md#principled-implementation
 *   An exact supplied record path keys one warning attempt; errno or the supplied
 *   error description explains the write failure reported by the caller. The
 *   key is marked before formatting/emission, not after confirmed user receipt.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper owns user-facing reporting while callers own cacheability and
 *   watching-session refusal.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The warning reports unsupported persistence rather than pretending that a
 *   module without its required project dependency can safely be cached.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain warning deduplication, error code and remedy;
 *   separate tags and parameter prose follow documentation guidance.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The set grows with the distinct unwritable record paths of the process and is never pruned, so its size has no bound beyond that population.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One Set lookup suppresses repeated formatting; the first attempt adds the
 *   path key, converts the error and constructs message text plus two native
 *   dirname results. Work follows path/error/message length and delegated Node
 *   warning processing, not just the fixed warning count.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The process-wide Set suppresses later attempts for the identical record
 *   spelling, even after recovery or a formatting/emission failure. Native aliases
 *   are not merged, and suppression is a reporting policy, not persistence proof.
 * @evidence contracts/portability.md#os-neutral-implementation The remedy names the directory with path.dirname, which uses the host's native separators, so it is spelled as the user's platform spells it.
 */
export function warnUnwritableProjectRecord(
  record: string,
  error: unknown,
): void {
  if (WARNED.has(record)) return;
  WARNED.add(record);
  const reason =
    (error as NodeJS.ErrnoException | undefined)?.code ?? String(error);
  process.emitWarning(
    `@ttsc/unplugin: the project record ${record} cannot be written ` +
      `(${reason}), nor anywhere else this host accepts it, so the host is ` +
      "not told when a type its modules consulted changes: those modules are " +
      "not cached where the host allows that, and a watching session refuses " +
      `them. Let the adapter write below ${path.dirname(path.dirname(record))}.`,
    { code: "TTSC_PROJECT_RECORD_UNWRITABLE" },
  );
}
