import path from "node:path";

import type { TtscProjectMutationTracker } from "../TtscProjectMutationTracker";
import { recordProjectChange } from "../recordProjectChange";
import { recordProjectMutation } from "../recordProjectMutation";
import type { WatchBrokerSink } from "./WatchBrokerSink";

/**
 * The sink a tracker's brokered watches report to: what each message of the
 * isolated watch process means to a generation's tracker.
 *
 * - An event is classified by the tracker's own filters, so a brokered tracker
 *   records exactly what the in-process listener would for the same event. With
 *   the exact-input trackers' classifier, it alone decides between a mutation,
 *   a content change, and nothing. With the project-directory tracker's
 *   filters, a named event is a mutation when it can change membership, a
 *   content change when it can change a program input's content, and otherwise
 *   nothing. Any other event is a mutation.
 * - An event the child could not place is a membership change of unknown kind.
 * - A failed watch fails the tracker, so its silence is never read as proof.
 * - A gap leaves the tracker hearing everything after it, so it is marked
 *   unverified, and its silence proves nothing until a delivery proves the
 *   recorded state again (samchon/ttsc#1425).
 * - A drain's verdict replaces the tracker's unproven set (samchon/ttsc#1453).
 *
 * @param tracker The tracker the watches are registered for.
 * @param filters The tracker's event decision: the exact-input trackers'
 *   classifier, or the project-directory tracker's membership, content, and
 *   new-membership filters.
 */
export function brokeredTrackerSink(
  tracker: TtscProjectMutationTracker,
  filters: {
    /** Whether a named `change` can add one unknown program path. */
    changeAddsMembership?: (location: string, filename: string) => boolean;
    /**
     * The exact-input trackers' event decision. When present it is the only
     * filter applied.
     */
    classify?: (
      location: string,
      filename: string | null,
      eventType: string,
    ) => "change" | "mutation" | undefined;
    /** Whether a named event can change compiler-consumed content. */
    content?: (location: string, filename: string) => boolean;
    /**
     * Whether a named event can be a program membership change, for the
     * project-directory tracker, which watches whole directories and so has to
     * narrow what it hears.
     */
    membership?: (location: string, filename: string) => boolean;
  } = {},
): WatchBrokerSink {
  return {
    event(directory, filename, eventType) {
      const changed =
        filename === null ? directory : path.join(directory, filename);
      if (filters.classify !== undefined) {
        const verdict = filters.classify(directory, filename, eventType);
        if (verdict === "mutation") recordProjectMutation(tracker, changed);
        else if (verdict === "change") recordProjectChange(tracker, changed);
        return;
      }
      if (filename !== null && filters.membership !== undefined) {
        if (
          filters.membership(directory, filename) &&
          (eventType === "rename" ||
            filters.changeAddsMembership?.(directory, filename) === true)
        ) {
          recordProjectMutation(tracker, changed);
          return;
        }
        if (
          eventType !== "rename" &&
          filters.content?.(directory, filename) === true
        ) {
          recordProjectChange(tracker, changed);
        }
        return;
      }
      recordProjectMutation(tracker, changed);
    },
    failed() {
      tracker.failed = true;
    },
    gap() {
      tracker.unverified = true;
    },
    unattributed() {
      tracker.membershipChanged = true;
    },
    unproven(directories) {
      if (directories === undefined) delete tracker.unproven;
      else tracker.unproven = directories;
    },
  };
}
