import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Directory adapters supplied by either the source or built test population.
 *
 * The listener preserves absent filenames and an optional observation gap.
 * openWatch supplies an explicit native-watch dependency to the actual adapter;
 * the returned handle owns its close and error-subscription boundary.
 *
 * @evidence contracts/common.md#principled-implementation The signature carries a directory, recursion policy and normalized notification callback, with an optional explicit native watch dependency.
 * @evidence contracts/common.md#clear-and-simple-design A structural handle exposes close and error subscription without importing a concrete source or built adapter type.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit openWatch parameter is a supported dependency boundary; it does not authorize replacing global fs.watch.
 * @evidence contracts/common.md#meaningful-documentation The native comment identifies source or built adapter selection; parameter documentation explains nullable filename and observation gaps.
 * @evidence contracts/portability.md#os-neutral-implementation Native location spelling and fs.watch signatures remain at the actual adapter boundary; notifications preserve missing names and explicit recursion.
 * @evidenceExclude contracts/performance.md#efficient-algorithms RecordedDirectoryAdapter defines a representation; it chooses no processing algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work RecordedDirectoryAdapter defines no computation-sharing or invalidation policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RecordedDirectoryAdapter carries data or signatures; acquisition and release remain with the implementing operation.
 */
export type RecordedDirectoryAdapter = (
  location: string,
  recursive: boolean,
  listener: (
    event: "change" | "rename",
    filename: string | null,
    gap?: boolean,
  ) => void,
  openWatch?: typeof fs.watch,
) => {
  close(): void;
  on(event: "error", listener: (error: Error) => void): unknown;
};

/**
 * An explicitly delivered observer notification, including a missing name.
 *
 * @evidence contracts/common.md#principled-implementation A string event and nullable filename preserve notifications whose native backend cannot identify an entry.
 * @evidence contracts/common.md#clear-and-simple-design The callback carries only delivered event data; registration state stays with its watcher owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing filenames remain null rather than a fabricated file identity.
 * @evidence contracts/common.md#meaningful-documentation The comment states that explicit notifications may lack a name.
 * @evidence contracts/portability.md#os-neutral-implementation Filename null represents actual native event ambiguity; this type does not infer platform case or watcher capability.
 * @evidenceExclude contracts/performance.md#efficient-algorithms RecordedWatchListener defines a representation; it chooses no processing algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work RecordedWatchListener defines no computation-sharing or invalidation policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources RecordedWatchListener carries data or signatures; acquisition and release remain with the implementing operation.
 */
export type RecordedWatchListener = (
  event: string,
  filename: string | null,
) => void;

/**
 * A subscription whose owner can close it before later notifications.
 *
 * @evidence contracts/common.md#principled-implementation Active state, callback, native location and recursion describe one independently closable recorded subscription.
 * @evidence contracts/common.md#clear-and-simple-design A single record carries the state needed for event admission and adapter-compatible close/on methods.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The record represents authored notifications, not an OS registration or proof that a native backend observed them.
 * @evidence contracts/common.md#meaningful-documentation Field comments identify active admission, callback location and compatibility-only error registration.
 * @evidence contracts/portability.md#os-neutral-implementation Location retains native resolved spelling and recursive is an explicit subscription option, not an inferred OS capability.
 * @evidenceExclude contracts/performance.md#efficient-algorithms IRecordedWatcher defines a representation; it chooses no processing algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work IRecordedWatcher defines no computation-sharing or invalidation policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IRecordedWatcher carries data or signatures; acquisition and release remain with the implementing operation.
 */
export interface IRecordedWatcher {
  /** Whether later authored notifications may invoke this subscription. */
  active: boolean;

  /**
   * Disable later authored notifications without removing the recorded history.
   *
   * @evidence contracts/common.md#principled-implementation The signature asks the implementing recorded handle to withdraw later notification admission.
   * @evidence contracts/common.md#clear-and-simple-design A void close method matches the handle boundary without exposing recorder storage.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts This test-owned handle changes its own active state and does not close or replace a foreign OS watcher.
   * @evidence contracts/common.md#meaningful-documentation The method comment explains that later authored events are disabled.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This signature describes a recorded handle; it performs no native close operation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The method signature chooses no processing algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Closing is an effectful withdrawal, not a reusable computation.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The recorder implements close by marking its handle inactive; the caller-owned registration array retains the record until its test releases it.
   */
  close(): void;

  /** Active-checked delivery callback; the recorder owns its admission guard. */
  listener: RecordedWatchListener;

  /** Native absolute subscription spelling used for lexical event routing. */
  location: string;

  /**
   * Return this recorded handle without installing a native error listener.
   *
   * Error-delivery scenarios must supply their own explicit observation input;
   * this compatibility method does not simulate a backend error channel.
   *
   * @evidence contracts/common.md#principled-implementation The signature preserves the recorder's chainable watcher-shaped surface.
   * @evidence contracts/common.md#clear-and-simple-design One no-argument method avoids inventing error-delivery state absent from this recorder.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The recorder's method is compatibility-only and does not claim actual native error events.
   * @evidence contracts/common.md#meaningful-documentation The method comment states that it returns the handle without installing a native error listener.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation No native watcher subscription is installed by this recorded-handle signature.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The signature specifies a returned handle and no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work There is no completed or in-flight computation to share.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no listener or resource; the recorder returns its existing handle.
   */
  on(): IRecordedWatcher;

  /** Explicit recursive subscription choice supplied to the adapter. */
  recursive: boolean;
}

/**
 * Record subscriptions through the caller's actual directory event adapter.
 *
 * Source units supply the source adapter; built boundary cases supply its built
 * counterpart. The operation stores callbacks and handle lifetimes without
 * registering an OS subscription or changing any global filesystem method.
 *
 * @evidence contracts/common.md#principled-implementation Records native-compatible subscription arguments and delivers callbacks only while their handle remains active; the supplied actual adapter owns directory event normalization.
 * @evidence contracts/common.md#clear-and-simple-design One recorder supplies file and directory operations and their shared registration array to both test populations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied operations replace an explicit dependency without modifying fs.watch or inventing topology results.
 * @evidence contracts/common.md#meaningful-documentation States source versus built adapter selection and that recorded registrations are not actual OS subscriptions.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution preserves location spelling; recursion comes from the actual subscription options.
 * @evidence contracts/performance.md#efficient-algorithms One registration appends one constant-size handle record; callback delivery performs no directory traversal.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each registration has its own callback and handle, with no retained computation reuse.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The test owns the returned array; topology close marks every acquired handle inactive and subsequent delivery respects that state.
 */
export function recordWatchers(adapter: RecordedDirectoryAdapter): {
  openDirectoryWatch: RecordedDirectoryAdapter;
  openFileWatch: typeof fs.watch;
  watchers: IRecordedWatcher[];
} {
  const watchers: IRecordedWatcher[] = [];
  const openFileWatch = ((location: fs.PathLike, ...rest: unknown[]) => {
    const listener = rest.find(
      (value): value is RecordedWatchListener => typeof value === "function",
    );
    const options = rest.find(
      (value): value is { recursive?: boolean } =>
        typeof value === "object" && value !== null,
    );
    const watcher: IRecordedWatcher = {
      active: true,
      close: () => {
        watcher.active = false;
      },
      listener: (event, filename) => {
        if (watcher.active) listener?.(event, filename);
      },
      location: path.resolve(String(location)),
      on: () => watcher,
      recursive: options?.recursive === true,
    };
    watchers.push(watcher);
    return watcher as unknown as fs.FSWatcher;
  }) as typeof fs.watch;
  const openDirectoryWatch: RecordedDirectoryAdapter = (
    location,
    recursive,
    listener,
  ) => adapter(location, recursive, listener, openFileWatch);
  return { openDirectoryWatch, openFileWatch, watchers };
}

/**
 * Deliver the authored path to every subscription that exists when the event
 * occurs.
 *
 * A listener may retire and reinstall subscriptions while handling the event,
 * as the topology does on a backend whose handle stays bound to a replaced
 * directory. An operating system never delivers an event that already happened
 * to a watcher installed after it, so the delivery set is fixed before the
 * first listener runs. Walking the live registration array would revisit every
 * reinstalled watcher without end.
 *
 * @evidence contracts/common.md#principled-implementation A snapshot of registrations fixes the event-time delivery population; only active handles whose lexical scope contains the entry receive the notification.
 * @evidence contracts/common.md#clear-and-simple-design One loop owns admission and callback delivery; the assertion exposes an authored event outside every registration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Callbacks may reinstall handles, but new registrations cannot receive an earlier event. This is authored topology input rather than an invented native watch observation.
 * @evidence contracts/common.md#meaningful-documentation The paragraphs explain why the delivery set is frozen before listener execution and why walking the live array would not terminate.
 * @evidence contracts/portability.md#os-neutral-implementation Native relative, basename and isAbsolute represent lexical watch scope; this helper does not prove physical alias equivalence or native event ordering.
 * @evidence contracts/performance.md#efficient-algorithms The registration array is copied once and scanned once; work and temporary storage scale with all recorded handles, including inactive historical entries.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every notification is a distinct effect and its delivery set is captured anew, not cached across events.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns registrations and their inactive history. This function retains only its event-local snapshot and starts no native handle or task.
 */
export function deliverWatchEvent(
  watchers: readonly IRecordedWatcher[],
  entry: string,
  event: string,
): void {
  let delivered = 0;
  for (const watcher of [...watchers]) {
    if (!watcher.active) continue;
    const relative = path.relative(watcher.location, entry);
    const observed =
      relative === "" ||
      relative === path.basename(entry) ||
      (watcher.recursive &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative));
    if (!observed) continue;
    watcher.listener(event, relative === "" ? path.basename(entry) : relative);
    delivered += 1;
  }
  assert.ok(delivered !== 0, `no registered watcher observes ${entry}`);
}

/**
 * Yield to queued microtasks and observer timers once.
 *
 * @evidence contracts/common.md#principled-implementation Awaiting one 20ms timer yields to queued microtasks and timers before the caller resumes.
 * @evidence contracts/common.md#clear-and-simple-design A single promise defines the fixture's explicit scheduling yield.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The delay is an authored observer scheduling allowance, not proof of native watcher completion or a fabricated product result.
 * @evidence contracts/common.md#meaningful-documentation The headline states one yield; callers must assert actual observed outcomes separately.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This scheduling helper performs no native filesystem or process operation.
 * @evidence contracts/performance.md#efficient-algorithms One timer is queued per call with constant local work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each caller needs its own scheduling transition; timer completion is not reused as watcher freshness proof.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One timer is owned by the promise and completes before return; the helper retains no historical state or ongoing task.
 */
export async function settleWatchEvents(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}
