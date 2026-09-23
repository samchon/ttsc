import type { TtscTransformFilesystemOperations } from "../../filesystem/TtscTransformFilesystemOperations";
import type { TtscProjectMutationTracker } from "../TtscProjectMutationTracker";
import type { WatchBrokerLocation } from "./WatchBrokerLocation";
import { brokeredTrackerSink } from "./brokeredTrackerSink";
import { openBrokeredWatch } from "./openBrokeredWatch";

/**
 * Register a generation's tracker with the isolated watch process, and resolve
 * once its watches hear.
 *
 * The watches report to the tracker's own sink (`brokeredTrackerSink`), which
 * applies the tracker's event decision, so a brokered tracker records exactly
 * what the in-process listener would for the same event (samchon/ttsc#1384).
 * The tracker drains through the broker's barrier, which on macOS proves each
 * probed stream delivered (samchon/ttsc#1453), and closing it removes its
 * watches. A read made after this resolves can never race the watches' start;
 * watches that report nothing within the probe timeout fail the tracker, as a
 * watch that could not be opened does.
 *
 * @param tracker The tracker the watches serve.
 * @param locations The directories to watch, in the tracker's spelling.
 * @param allEvents Whether `change` events are wanted, or renames alone.
 * @param filesystem The filesystem the canonical directories are read through.
 * @param options.filters The tracker's event decision (`brokeredTrackerSink`).
 * @param options.probeRoot The project root, below whose tool cache a probe may
 *   prove a location's stream delivered; a location outside it cannot be, and
 *   every drain names it in the tracker's unproven set.
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
