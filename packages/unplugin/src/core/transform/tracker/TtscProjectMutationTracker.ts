/** Generation-scoped directory watchers used to detect membership changes. */
export interface TtscProjectMutationTracker {
  /** Absolute paths named by generation-time mutation events. */
  changes: Set<string>;
  /** Whether additional event paths were discarded after the witness bound. */
  changesOmitted: boolean;
  close: () => void;
  /**
   * Absolute spellings whose creation, change or removal this tracker would
   * report, when it watches exact names rather than whole directories.
   *
   * A validation that finds an input here needs no filesystem call of its own:
   * the tracker is the evidence, and every path that leaves this set falls back
   * to being proven by hand. Empty for a tracker that watches directories as a
   * whole, which cannot answer for one name.
   */
  covered?: ReadonlySet<string>;
  /** Whether this is the repository-owned backend with content-event coverage. */
  contentAuthoritative?: boolean;
  /**
   * Wait until every event this tracker's watcher has already dispatched has
   * been applied to it.
   *
   * An in-process watcher drains on the next macrotask turn, because its
   * callbacks are already queued on this loop. A watcher living in the Windows
   * broker drains by round-trip instead: the child replies after its own turn,
   * and IPC preserves order, so the reply cannot overtake an event the child
   * had already sent (samchon/ttsc#1272).
   */
  drain?: () => Promise<void>;
  failed: boolean;
  membershipChanged: boolean;
  /** Compare event and input paths through this tracker's filesystem identity. */
  overlaps?: (input: string, changed: string) => boolean;
  settle?: Promise<void>;
}
