import type { TtscTransformFilesystemOperations } from "../../filesystem/TtscTransformFilesystemOperations";
import type { TtscProjectMutationTracker } from "../TtscProjectMutationTracker";
import type { WatchBrokerLocation } from "./WatchBrokerLocation";
import { brokeredTrackerSink } from "./brokeredTrackerSink";
import { openBrokeredWatch } from "./openBrokeredWatch";

/**
 * Register a generation's tracker with the isolated watch process, and resolve
 * when the broker registration's opening wait ends.
 *
 * The watches report to the tracker's own sink (`brokeredTrackerSink`), which
 * applies the tracker's shared exact-input classifier or project membership
 * and content filters (samchon/ttsc#1384). Authority withdrawal is distinct
 * from recording a structural or content witness.
 * The registration transfers its drain and closer to the tracker before this
 * awaits readiness. Probe-dependent streams need a delivered probe for drain
 * authority (samchon/ttsc#1453); the sink keeps unproven scopes separately.
 * The opening wait can also end after failure, timeout or explicit closure, so
 * resolution alone does not certify coverage. Closing first fails the tracker
 * and then attempts broker retirement; cleanup failure can still escape.
 *
 * @param tracker The tracker the watches serve.
 * @param locations The directories to watch, in the tracker's spelling.
 * @param allEvents Whether `change` events are wanted, or renames alone.
 * @param filesystem The filesystem the canonical directories are read through.
 * @param options.filters The tracker's event decision (`brokeredTrackerSink`).
 * @param options.probeRoot The project root, below whose tool cache a probe may
 *   prove a location's stream delivered; a location outside it cannot be, and
 *   probe-dependent streams without an eligible probe remain unproven.
 * @evidence contracts/common.md#principled-implementation
 *   One sink transfers broker verdicts into the tracker, and the returned drain
 *   and closer transfer registration ownership before awaiting opening. Normal
 *   completion includes failed/closed openings; the caller must use tracker
 *   authority fields rather than treat Promise resolution as successful coverage.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This adapter wires one registration into the tracker lifecycle; canonical
 *   paths, child process and timeout state remain owned by openBrokeredWatch.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Closure marks coverage failed before native cleanup. Routed opening failure
 *   remains a sink verdict rather than fabricated coverage, while synchronous
 *   setup exceptions propagate without a successful handle transfer.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs and parameter comments explain readiness, filtering and
 *   probe scope under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral tracker ownership delegates native isolation, stream probing and
 *   canonical spelling translation to the broker boundary.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One sink and closer are allocated, but opening still processes all location
 *   spellings and delegates native identity/probe preparation, namespace scans,
 *   IPC and child stream work. Location/name bytes, native scope and outstanding
 *   broker population drive cost, not this adapter's statement count.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The loaded broker owner shares its child and eligible covering in-flight
 *   drains; this tracker receives a drain bound to its registration ID. Each
 *   registration's sink and opening effects remain independent, and shared
 *   holder/address state is not a fresh coverage or access certificate.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   After opening returns a handle, the tracker owns its sink, drain and closer
 *   before readiness is awaited. Close withdraws authority before attempting
 *   removal and last-child retirement. Synchronous opening failure can precede
 *   that transfer; caller cancellation is not implemented. Broker registration,
 *   pending scope and namespace populations have no count/byte cap, and native
 *   cleanup or callback failure does not guarantee successful release.
 */
export async function registerBrokeredMutationTracker(
  tracker: TtscProjectMutationTracker,
  locations: readonly WatchBrokerLocation[],
  allEvents: boolean,
  filesystem: TtscTransformFilesystemOperations,
  options: {
    filters?: Parameters<typeof brokeredTrackerSink>[1];
    probeRoot?: string;
  } = {},
): Promise<void> {
  const watch = openBrokeredWatch(locations, {
    allEvents,
    drains: true,
    filesystem,
    ...(options.probeRoot === undefined
      ? {}
      : { probeRoot: options.probeRoot }),
    sink: brokeredTrackerSink(tracker, options.filters),
  });
  tracker.drain = watch.drain;
  tracker.close = () => {
    tracker.failed = true;
    watch.close();
  };
  await watch.ready;
}
