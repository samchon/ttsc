import path from "node:path";

/** The records this process already warned about. */
const WARNED = new Set<string>();

/**
 * Tell the user, once per record and process, that a module went to its host
 * without the project's record, because the record could be written neither
 * below the host's root nor anywhere else the host accepts it, and does not
 * exist (samchon/ttsc#1480).
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
