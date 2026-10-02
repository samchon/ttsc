import { WATCH_PROBE_TIMEOUT_MS } from "./WATCH_PROBE_TIMEOUT_MS";
import type { WatchBroker } from "./WatchBroker";

/**
 * Ask the watch broker to acknowledge, and resolve with whether it did.
 *
 * The child answers after two turns of its own loop, so a watch callback it had
 * already queued has run, and the ordered IPC channel puts every message it
 * sent before the reply ahead of the reply. That is the same proof an
 * in-process watcher gets from a macrotask turn, rather than the fixed wait
 * this replaces, which guessed at the crossing (samchon/ttsc#1272). On macOS
 * the child answers once each stream it can prove has delivered a probe, which
 * takes the service's latency (samchon/ttsc#1453).
 *
 * A broker that never answers must not hold a delivery, so the wait gives up
 * after a threshold of twice the probe timeout: the child itself gives up on a
 * stream that does not deliver within one. Scheduling or IPC delay can also
 * exhaust the parent's wait; timeout does not establish a dead child or a
 * permanently incapable backend. It resolves `false` then, and when the broker
 * dies, since an event may still be in flight: the caller must not read the
 * trackers' silence as proof (samchon/ttsc#1428). It used to give up after 10
 * ms and resolve as if answered, so a busy host or a child forwarding a burst
 * lost the edit a delivery was about to serve.
 *
 * A reply speaks only for the registrations the child held when the request
 * reached it, which are those registered before the request was sent. A
 * registration opened after an in-flight drain was sent therefore does not
 * share it: its watches were never probed by that drain, so it starts one that
 * covers it (samchon/ttsc#1546).
 * A caller without a registration id can join the current drain without this
 * coverage check. Sharing keeps that request's original timeout; a later
 * override does not reset it. Timer thresholds require event-loop progress
 * and are not global wall-time guarantees. Exceptional native/ref/send work
 * can reject the request rather than supplying an acknowledgment.
 *
 * @param timeout How long to wait for the reply; the default is what the child
 *   is given plus the same again, and a test of the wait itself passes less.
 * @param registration The registration asking, when one is; it shares the
 *   in-flight drain only when that drain covers it.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Id-bound replies establish ordering only for the snapshot of registrations
 *   held before submission; timeout withdraws proof rather than certifying silence.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One scope snapshot and shared promise represent the current barrier;
 *   startWatchBrokerDrain owns request bookkeeping and idempotent release.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Later registrations need a covering drain; a deadline cannot manufacture
 *   native acknowledgment or be replaced with an arbitrary fixed-delay success.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs and parameters explain ordering, coverage, sharing and
 *   false deadlines under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral host delivery delegates Windows loop ordering and macOS stream
 *   probing to the native broker rather than applying one universal timing guess.
 * @evidence contracts/performance.md#efficient-algorithms
 *   A covering memo query uses fixed identity/id lookup. New requests copy all N
 *   registration pairs before filtering draining ids into a scope, then create
 *   timer/promise/IPC state. The child still scans its registration streams and
 *   writes shared namespace probes; reply routing scans unproven entries and
 *   live registrations. Native/IPC/callback and total scope populations remain
 *   delegated work beyond parent-map lookup; no project file walk occurs here.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Scoped callers share a current request only when its snapshot contains their
 *   id; unscoped callers join without that check. The original request's timeout
 *   governs all sharers. Ordered IPC and child proof own the acknowledgment;
 *   finally clears only its still-current promise, preserving a newer request.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Each request retains an id/scope/timer/release closure and increments shared
 *   pending demand; refs are flags, not independently counted native handles.
 *   Completed reply/timeout/exit release clears scope/timer and permits unref
 *   when all requests/openings finish. Uncovered calls can create uncapped
 *   outstanding requests with storage driven by the sum of their scope sizes.
 *   Scheduling/native or callback exceptions can delay/interrupt settlement;
 *   there is no caller cancellation or hard wall-time guarantee here.
 */
export function drainWatchBroker(
  broker: WatchBroker,
  timeout: number = 2 * WATCH_PROBE_TIMEOUT_MS,
  registration?: number,
): Promise<boolean> {
  // A covering registration shares the current round-trip. A later uncovered
  // registration needs its own request rather than inheriting that proof.
  if (
    broker.draining !== undefined &&
    (registration === undefined ||
      broker.drainingScope?.has(registration) === true)
  ) {
    return broker.draining;
  }
  const scope = new Set(
    [...broker.registrations]
      .filter(([, entry]) => entry.drains)
      .map(([id]) => id),
  );
  const draining: Promise<boolean> = startWatchBrokerDrain(
    broker,
    timeout,
    scope,
  ).finally(() => {
    if (broker.draining === draining) {
      broker.draining = undefined;
      broker.drainingScope = undefined;
    }
  });
  broker.draining = draining;
  broker.drainingScope = scope;
  return draining;
}

function startWatchBrokerDrain(
  broker: WatchBroker,
  timeout: number,
  scope: ReadonlySet<number>,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const id = broker.nextId++;
    let settled = false;
    const release = (answered: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      broker.drains.delete(id);
      broker.drainScopes?.delete(id);
      broker.pendingDrains -= 1;
      if (broker.pendingDrains === 0 && broker.pendingRegistrations === 0) {
        broker.child.unref();
        broker.child.channel?.unref?.();
      }
      resolve(answered);
    };
    // Hold the channel open while the acknowledgement is outstanding. The
    // broker is unreferenced between requests so it never keeps a host alive,
    // and a reply is the only thing this promise can be resolved by: without
    // the reference the loop can empty while a delivery waits here, and the
    // process exits mid-build with nothing to report.
    broker.pendingDrains += 1;
    broker.child.ref();
    broker.child.channel?.ref?.();
    const timer = setTimeout(() => release(false), timeout);
    broker.drains.set(id, release);
    (broker.drainScopes ??= new Map()).set(id, scope);
    if (broker.child.send?.({ id, op: "drain" }) !== true) {
      release(false);
    }
  });
}
