/** Generation-scoped directory watchers used to detect membership changes. */
export interface TtscProjectMutationTracker {
  /** Absolute paths named by generation-time mutation events. */
  changes: Set<string>;
  /** Whether additional event paths were discarded after the witness bound. */
  changesOmitted: boolean;
  /**
   * Release the watchers and mark the tracker failed, so nothing trusts it
   * afterwards.
   */
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
  /**
   * Whether the watcher could not be opened, has errored, or was closed; a
   * failed tracker proves nothing either way.
   */
  failed: boolean;
  /**
   * Whether a rename or equivalent membership event was observed since the
   * tracker opened.
   */
  membershipChanged: boolean;
  /**
   * Whether the backend may have dropped events since the state was last
   * proven, as a macOS watch does while libuv re-creates the FSEventStream it
   * shares (samchon/ttsc#1418). Unlike {@link failed}, the tracker still hears
   * everything after the gap, so one delivery that proves the recorded state by
   * reading it clears the flag, and its silence is proof again.
   */
  unverified?: boolean;
  /** Compare event and input paths through this tracker's filesystem identity. */
  overlaps?: (input: string, changed: string) => boolean;
  /**
   * The drain currently in flight, shared by concurrent deliveries so one
   * barrier serves them all.
   */
  settle?: Promise<void>;
  /**
   * Re-check that every watched directory is still the one the watch opened on,
   * and fail the tracker when one is not.
   *
   * An inotify watch follows the inode, and FSEvents does not report a watched
   * root that moves, so replacing a watched directory, or any of its ancestors,
   * leaves the watch observing the old directory while the new one goes
   * unheard, and silence would then be read as proof (samchon/ttsc#1384). One
   * metadata call per watched directory, made once per delivery, bounds that
   * window.
   *
   * @param seen Identities already read during this verification, by directory,
   *   shared across a generation's trackers so a directory they all watch is
   *   read once.
   */
  verifyLocations?: (seen?: Map<string, string | undefined>) => void;
}
