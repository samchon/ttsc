/**
 * A watching session's delivery refused because no project record could be
 * handed to the host with it (samchon/ttsc#1480).
 *
 * A build host watches a module and its project's record, and hears a type the
 * module's output consulted change only as the record moving. Handed over
 * without one, the module would be served from the host's watcher's silence
 * after such a change for the rest of the session. Where the host accepts the
 * record nowhere the adapter can write, the delivery fails instead, naming the
 * directory, so the session never serves output it cannot keep current. A
 * one-shot build is correct without the record, and is never refused.
 */
export class TtscProjectRecordUnwritableError extends Error {
  /** The record that could not be written. */
  public readonly record: string;

  /**
   * @param record The record that could not be written below the host's root.
   * @param cause What refused the write.
   */
  public constructor(record: string, cause: unknown) {
    super(
      `@ttsc/unplugin: the project record ${record} cannot be written ` +
        `(${(cause as NodeJS.ErrnoException | undefined)?.code ?? String(cause)}), ` +
        "and this host accepts it nowhere else, so this watching session " +
        "would not hear a type its modules consulted change. Let the adapter " +
        "write below the host's root, or run a one-shot build.",
      { cause },
    );
    this.name = "TtscProjectRecordUnwritableError";
    this.record = record;
  }
}
