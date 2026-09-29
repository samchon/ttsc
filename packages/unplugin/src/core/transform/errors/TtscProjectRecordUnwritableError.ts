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
 *
 * @evidence contracts/common.md#principled-implementation A typed error carries the refused record and original cause, distinguishing inability to maintain a watching delivery from the one-shot path that needs no record.
 * @evidence contracts/common.md#clear-and-simple-design The value owns failure context only; directory selection, record writing and watching-session policy remain with their respective operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The failure exposes missing invalidation capability instead of letting watcher silence stand in for evidence the host never received.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain why a watching delivery must fail and when one-shot builds remain valid; constructor parameter comments identify the record and cause.
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
