import path from "node:path";

import type { InputObserverOperations } from "../observer/InputObserverOperations";
import { createInputObserver } from "../observer/createInputObserver";
import { hostDeclaresPolling } from "../transform/tracker/hostDeclaresPolling";
import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";
import type { HostWatchBridge } from "./HostWatchBridge";
import { signalProjectRecordFile } from "./signalProjectRecordFile";

/**
 * Open the watch bridge for one watching build session: the adapter's own
 * observer of registered generation inputs, which requests host invalidation by
 * moving the project's record (samchon/ttsc#1388).
 *
 * A host's own watcher observes the compiler's inputs imprecisely, or not at
 * all, and each host differently: one never reports a created path or a
 * directory gaining an entry, one opens a watcher per registered path, one
 * loses a change that lands while it builds or before it records its baseline,
 * one fails a module on a dependency outside its root or reads a directory as a
 * file. The host is therefore handed no input at all, only the project's record
 * (`projectRecordFile`), and the bridge observes the inputs with the adapter's
 * own bounded observer (`createInputObserver`): one project scope plus at most
 * 16 external ones, and a precise predicate re-check per event. Each record is
 * one owner of the observer, and an owner whose inputs changed moves its record
 * (`signalProjectRecordFile`, samchon/ttsc#1485).
 *
 * A signal moves the record at once and is owed until a registration whose
 * delivery read the post-signal state answers it (principle C). A host takes a
 * file's state as its baseline at a moment of its own choosing, which may lie
 * after the move: Turbopack when it processes the loader's result
 * (samchon/ttsc#1423), Rspack when its watcher records the file's time after a
 * build, Rolldown after the build a change landed in. So the record is moved
 * again, with a delay that grows fourfold up to Node's timer maximum, until a
 * registration answers: however late the host takes its baseline, a later move
 * lands after it, and a record the host never registers again costs a number of
 * moves reduced by exponential backoff before that maximum. A host that heard
 * the first move runs the project's modules before the second is due when
 * scheduling and the host permit it, and their registrations end it; a pool
 * worker that never sees the registration keeps moving the record after another
 * worker delivered, and the host then runs the modules once more, from its
 * cache, which registers and ends it there.
 *
 * The later moves defend the host's watcher, so a host that reports what each
 * compile depended on (`HostWatchBridge.compiled`) has them only for the
 * records its watcher observes. A compiler holding no module of a project,
 * Next's edge compiler beside the client and server ones, never delivers the
 * registration that ends them, and each would run the compilers that do observe
 * the record again. Such a record is still observed and moved once per change:
 * a compile that comes to depend on it, as `next dev` does a page on its first
 * request, reads the move through its cache's snapshot.
 *
 * The record stays when the bridge closes: a host with a persistent cache
 * recorded it as a dependency of every module, and a build start proves it
 * against the disk (`refreshProjectRecordFiles`).
 *
 * @param root The directory whose pinned scope observes the project.
 * @param operations Observer watch/poll/case capabilities, which do not replace
 *   native record writes or the filesystem used to recheck input conditions.
 * @param polling The current host's polling declaration, including its active
 *   watch-session option. Standalone callers retain the environment default.
 * @evidence contracts/common.md#principled-implementation
 *   Each record owns generation input evidence. A change remains owed until a
 *   registration replaces that evidence; replacement immediately signals again
 *   when its capture token predates a change. Repeated moves protect host baselines
 *   taken after the first move, and compile dependency reports suppress retries
 *   where the host reports no dependency on that record. A report or a move
 *   does not prove actual watcher health, delivery timing or eventual settlement.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One observer owns input truth; registered/owed/pending/unwatched collections
 *   separately express delivery identity, unsettled changes, timers and host
 *   participation. Helpers centralize settlement and movement so every lifecycle
 *   transition updates the same owned state rather than mutating host watchers.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   This preserves the host filesystem boundary while one owned observer
 *   serves project records; record signalling does not replace the host's
 *   methods.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The JSDoc explains why the adapter owns observation, why a record
 *   represents a project and when a delivery can settle an owed signal.
 *   Purpose and reasons are separate native paragraphs under the documentation
 *   skill; the returned interface documents its lifecycle operations.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Native paths and Node filesystem operations locate records below the
 *   host's resolved root. Input identity and notification transport are
 *   delegated to the shared observer, which isolates Windows and macOS brokers
 *   from other native watches. Host dependency channels remain the adapter
 *   boundary rather than an assumed common watcher API.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   R participating records use map/set lookup for registration and movement;
 *   compiled scans R and pays the supplied dependency predicate's cost. Native
 *   record resolution/movement retains path/serialization/read/write cost, while
 *   observer replacement retains input/evidence indexing and proof costs.
 *   Identical input-array/token deliveries skip repeat registration. Retry delay
 *   grows fourfold up to the timer maximum; this reduces frequency, not total
 *   historical moves, elapsed lifetime or per-move byte cost.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   One observer shares scopes and conditions under its resolved lexical input
 *   and condition keys; native event aliases do not merge every physical input.
 *   Identical generation input arrays with the same capture token reuse their
 *   established live registration; a failed delivery or different token cannot.
 *   Array immutability and capture-token identity are required by the shortcut;
 *   changed populations publish new arrays. Change sequence and input evidence,
 *   not a quiet host watcher, govern the observer's separate proof checks.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The bridge owns its observer and at most one retry timer per owed watched
 *   record. Registration settles that timer; compiled removes timers for absent
 *   dependencies; close clears timers and record state before observer disposal.
 *   Historical registrations grow with participating projects until close and
 *   there is no fixed cap on their retained input bytes. Retry history has no
 *   finite total-move bound while an unsettled watched record remains. Observer
 *   close is best effort, and the opened root/pass window can survive close for
 *   later registration; completion does not certify every native handle's release.
 */
export function openHostWatchBridge(
  root: string,
  operations: Partial<InputObserverOperations> = {},
  polling: boolean = hostDeclaresPolling(process.env),
): HostWatchBridge {
  // Every map below is keyed by the record's absolute spelling, the one the
  // observer reports its owners under.
  // What each record was last registered with.
  const registered = new Map<
    string,
    { inputs: readonly TtscWatchInput[]; startedAt: number | undefined }
  >();
  // The records signalled since they last registered.
  const owed = new Set<string>();
  // The pass a signal was last answered in, and the current pass: a host that
  // asks per module whether its cache may serve it, Rollup, is answered for
  // the pass the signal was answered in and the one after it. The delivery
  // that answers vouches for the project's state, not for the modules the
  // same pass served before it read that state, and a change that lands
  // while the host builds is answered by a module late in that very pass; so
  // the host runs every module once more in the next pass, which registers
  // them all against the answered state.
  let pass = 0;
  let lastBegin: number | undefined;
  let answeredIn: number | undefined;
  // The next move owed to each record, until it is registered again.
  const pending = new Map<string, NodeJS.Timeout>();
  // The records the host's last compile did not depend on, which its watcher
  // does not observe, reported by a host that reports it (`compiled`).
  const unwatched = new Set<string>();
  const settle = (record: string): void => {
    owed.delete(record);
    clearTimeout(pending.get(record));
    pending.delete(record);
  };
  const signal = (record: string): void => {
    owed.add(record);
    // A signal already owed keeps its schedule, which still lands a move
    // after whatever baseline the host takes next.
    if (pending.has(record)) return;
    signalProjectRecordFile(record);
    // The later moves defend a watcher's baseline, and no watcher of this host
    // observes the record: a compile that comes to depend on it reads this
    // move through its cache's snapshot, and `compiled` resumes the schedule
    // for the signal still owed once the watcher observes the record.
    if (unwatched.has(record)) return;
    const moveAfter = (delay: number): void => {
      const timer = setTimeout(() => {
        if (pending.get(record) !== timer) return;
        signalProjectRecordFile(record);
        moveAfter(Math.min(delay * 4, MAX_TIMER_DELAY_MS));
      }, delay).unref();
      pending.set(record, timer);
    };
    moveAfter(FIRST_SIGNAL_DELAY_MS);
  };
  // A record whose inputs changed and one whose project only gained or lost a
  // root file are the same news to a build host: its modules must run again.
  const observer = createInputObserver(({ invalidate, reload }) => {
    for (const record of reload) signal(record);
    for (const record of invalidate) signal(record);
  }, operations);
  observer.open(root, polling);
  return {
    begin: () => {
      pass += 1;
      lastBegin = observer.begin();
      return lastBegin;
    },
    close: async () => {
      for (const record of [...pending.keys()]) settle(record);
      owed.clear();
      registered.clear();
      unwatched.clear();
      await observer.dispose();
    },
    compiled(depends) {
      for (const record of registered.keys()) {
        if (!depends(record)) {
          // Observed still, and still owed, but moved no more on the schedule.
          unwatched.add(record);
          clearTimeout(pending.get(record));
          pending.delete(record);
        } else if (unwatched.delete(record) && owed.has(record)) {
          signal(record);
        }
      }
    },
    owes: (record) =>
      (answeredIn !== undefined && pass <= answeredIn + 1) ||
      (record === undefined ? owed.size !== 0 : owed.has(path.resolve(record))),
    register(file, inputs, failed, startedAt) {
      const record = path.resolve(file);
      // Deliveries with the same immutable input population and pass reuse
      // the established observation. A generation whose later module adds
      // selection inputs publishes a new array, which must update coverage
      // rather than being mistaken for another identical delivery.
      const last = registered.get(record);
      if (
        last !== undefined &&
        last.inputs === inputs &&
        last.startedAt === startedAt &&
        failed !== true
      ) {
        return;
      }
      registered.set(record, { inputs, startedAt });
      if (
        owed.has(record) &&
        startedAt !== undefined &&
        startedAt === lastBegin
      ) {
        answeredIn = pass;
      }
      // The delivery being registered answers every signal owed so far. If it
      // read a state a change since `startedAt` has left, the replacement
      // finds that at once and signals again.
      settle(record);
      observer.replace(record, inputs, failed, startedAt);
    },
  };
}

/**
 * How long a signal waits before its second move, in milliseconds: long enough
 * for a host that heard the first to run and register the project's modules
 * again, which answers the signal before any further move.
 */
const FIRST_SIGNAL_DELAY_MS = 50;

/** The longest delay a Node timer takes as given, in milliseconds. */
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;
