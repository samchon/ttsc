import path from "node:path";

import type { TtscProjectMutationTracker } from "../TtscProjectMutationTracker";
import { recordProjectChange } from "../recordProjectChange";
import { recordProjectMutation } from "../recordProjectMutation";
import type { WatchBrokerSink } from "./WatchBrokerSink";

/**
 * The sink a tracker's brokered watches report to: what each message of the
 * isolated watch process means to a generation's tracker.
 *
 * - An event is classified by the tracker's own filters. With the exact-input
 *   trackers' shared classifier, it alone decides between a mutation, a content
 *   change, and no recorded change; uncertain native aliases can independently
 *   withdraw the tracker's verification authority. With the project-directory
 *   tracker's filters, a named event records membership when admitted and
 *   structural, or content for an admitted non-rename event. Rejected
 *   membership can still withdraw authority through the owner filter. Events
 *   without that filter are mutations.
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
 * @evidence contracts/common.md#principled-implementation
 *   Owner filters classify events; failed, gap and partial drain messages update
 *   different authority fields rather than pretending they are mutations.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One sink adapts the broker protocol to tracker state and delegates exact
 *   input classification wholesale, keeping backend policies equivalent.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Unattributed events remain structural witnesses and failed coverage remains failed;
 *   the adapter neither suppresses events nor patches a foreign watcher.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native message list and parameter comments distinguish each verdict and
 *   classifier precedence under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral event construction uses node:path and owner-translated directory
 *   spellings; native drop and probe semantics are explicit protocol inputs.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The sink retains its tracker and owner filters until registration retirement.
 *   A supplied unproven-directory Set transfers to the tracker and is replaced
 *   by subsequent drain verdicts; the tracker close retires its registration.
 * @evidence contracts/performance.md#efficient-algorithms Each message follows one handler; named events include native path construction, delegated owner classification and bounded witness recording. Those costs follow path text and the owner's scope indexes, not the adapter's statement count.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each tracker has its own sink, and events are effects rather than computations to share.
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
