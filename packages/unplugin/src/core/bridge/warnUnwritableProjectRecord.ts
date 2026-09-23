import path from "node:path";

/** The records this process already warned about. */
const WARNED = new Set<string>();

/**
 * Tell the user, once per record and process, that a module went to its host
 * without the project's record, because the record could not be written and
 * does not exist.
 *
 * A build host watches a module and its record and nothing else, so a module
 * handed over without the record depends on its own bytes alone: a watching
 * session does not rebuild it when a type its output consulted changes. The
 * adapter marks such a module uncacheable where the host allows that, so no
 * persistent cache restores it on those bytes, and names the cause with its
 * remedy, as a Node process warning, code `TTSC_PROJECT_RECORD_UNWRITABLE`.
 *
 * @param record The record that could not be written.
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
      `(${reason}), so the host is not told when a type its modules ` +
      "consulted changes, and those modules are not cached where the host " +
      `allows that. Let the adapter write below ${path.dirname(path.dirname(record))}.`,
    { code: "TTSC_PROJECT_RECORD_UNWRITABLE" },
  );
}
