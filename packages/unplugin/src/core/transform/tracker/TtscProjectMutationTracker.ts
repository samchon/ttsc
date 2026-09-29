/**
 * Generation-scoped notification coverage and observed mutation witnesses.
 *
 * Failure withdraws authority; membership change is positive invalidation.
 * Drainage, directory identity and input scope determine what silence can
 * prove.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Independent failure, verification and membership fields distinguish loss
 *   of authority from an observed change; exact coverage remains optional.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One generation-owned interface carries verdicts and its lifecycle methods;
 *   backend protocol state is not exposed to validation consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The representation preserves uncertainty instead of forcing all events
 *   into a stale boolean or certifying silence through path-specific exceptions.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native type and member paragraphs distinguish authority, witnesses and
 *   lifecycle, with separated members under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral consumers use owned comparison and verification operations;
 *   native backend differences do not change the meaning of the verdict fields.
 */
export interface TtscProjectMutationTracker {
  /** Absolute paths named by generation-time mutation events. */
  changes: Set<string>;

  /** Whether additional event paths were discarded after the witness bound. */
  changesOmitted: boolean;

  /**
   * Release the watchers and mark the tracker failed, so nothing trusts it
   * afterwards.
   */
  close: CloseProjectMutationTracker;

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
   *
   * Resolves whether the barrier held. One that did not, such as a broker that
   * never answered, leaves an event possibly in flight, so the tracker is
   * marked {@link unverified} (samchon/ttsc#1428).
   */
  drain?: DrainProjectMutationTracker;

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
   * proven, as FSEvents reports it may have done (samchon/ttsc#1425), or a
   * drain could not prove every event arrived (samchon/ttsc#1428). Unlike
   * {@link failed}, the tracker still hears everything after the gap, so one
   * delivery that proves the recorded state by reading it clears the flag, and
   * its silence is proof again.
   */
  unverified?: boolean;

  /**
   * The watched directories, in the walk's own spelling, whose backend the last
   * drain could not prove delivered (samchon/ttsc#1453): a macOS stream with no
   * probe directory below its root, which FSEvents delivers with a latency no
   * drain can wait out. An input below one is not proven by this tracker's
   * silence, and is proven by reading instead; every other input keeps its
   * proof. Replaced by every drain, so a stream proven later proves again.
   */
  unproven?: ReadonlySet<string>;

  /** Compare event and input paths through this tracker's filesystem identity. */
  overlaps?: ProjectMutationOverlap;

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
  verifyLocations?: VerifyProjectMutationLocations;
}

/**
 * End tracker notification ownership and withdraw its authority.
 *
 * @evidence contracts/common.md#principled-implementation Closure ends owned notification and sets failed authority.
 * @evidence contracts/common.md#clear-and-simple-design A parameterless callback preserves assignable function-property semantics across backends.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Quiet closed handles cannot remain a validation proof.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies both release and authority withdrawal, with documentation-skill spacing.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral callers close through the owner without knowing its native backend.
 */
export type CloseProjectMutationTracker = () => void;

/**
 * Await backend delivery ordering; false withdraws the barrier's proof.
 *
 * The owning tracker chooses a loop turn or ordered IPC barrier. This result
 * describes delivery ordering, independently of recorded file-state validity.
 *
 * @evidence contracts/common.md#principled-implementation The boolean represents backend ordering authority rather than file-state validation.
 * @evidence contracts/common.md#clear-and-simple-design One asynchronous callback preserves the optional owning property's function variance.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A timeout cannot fabricate a successful drain.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish ordering from validation and explain false-result meaning under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral consumers use each backend's supported queue boundary instead of transferring one platform's timing assumption.
 */
export type DrainProjectMutationTracker = () => Promise<boolean>;

/**
 * Compare an input and event path through the tracker's filesystem identity.
 *
 * @evidence contracts/common.md#principled-implementation The callback supplies dependency overlap under the owning filesystem's identity.
 * @evidence contracts/common.md#clear-and-simple-design Two spellings yield one overlap verdict without coupling to tracker state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The boundary contains no fixture exemptions or foreign-state patching.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the comparison owner; named parameters identify both inputs under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral callers delegate physical aliases and directory case policy instead of universally lowercasing paths.
 */
export type ProjectMutationOverlap = (
  input: string,
  changed: string,
) => boolean;

/**
 * Withdraw tracker authority when a watched directory's identity changes.
 *
 * @param seen Identities observed during this delivery's verification, shared
 *   between trackers watching the same directory.
 * @evidence contracts/common.md#principled-implementation Physical mismatch withdraws proof even when the old watched object remains quiet.
 * @evidence contracts/common.md#clear-and-simple-design One callback owns verification; its optional memo remains delivery-local.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Lexical equality cannot substitute for physical directory identity after replacement.
 * @evidence contracts/common.md#meaningful-documentation Native prose and parameter documentation state withdrawal and memo lifetime under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral verification follows owned physical identity through aliases and ancestors rather than an OS-wide casing rule.
 */
export type VerifyProjectMutationLocations = (
  seen?: Map<string, string | undefined>,
) => void;
