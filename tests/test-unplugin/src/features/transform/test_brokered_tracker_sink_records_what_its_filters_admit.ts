import assert from "node:assert/strict";
import path from "node:path";

import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/TtscProjectMutationTracker.mjs";
import { brokeredTrackerSink } from "../../../../../packages/unplugin/lib/core/transform/tracker/broker/brokeredTrackerSink.mjs";

/**
 * Verifies a tracker's brokered watches record exactly what its filters admit,
 * and what befell the watches as the tracker's flags (samchon/ttsc#1384,
 * samchon/ttsc#1485).
 *
 * A brokered tracker must record what the in-process listener would for the
 * same event, or a Windows or macOS delivery would compile where Linux serves,
 * or serve where it compiles. And a failed watch or a dropped event must never
 * let the tracker's silence stand as proof (samchon/ttsc#1418,
 * samchon/ttsc#1425).
 *
 * 1. Tell a sink without filters an event without a name, one with a name, a
 *    placeless event, a gap, a failure, and drain verdicts, and assert each is
 *    the witness or flag it means.
 * 2. Tell a sink with the exact-input trackers' classifier events it rules a
 *    mutation, a change, and nothing, and assert the classifier alone decides.
 * 3. Tell a sink with the project-directory tracker's filters a table of renames
 *    and changes, and assert each records the witness its filters admit.
 */
export async function test_brokered_tracker_sink_records_what_its_filters_admit(): Promise<void> {
  const directory = path.resolve("/walked/project");
  const tracker = (): TtscProjectMutationTracker => ({
    changes: new Set(),
    changesOmitted: false,
    close: () => undefined,
    failed: false,
    membershipChanged: false,
  });
  const recorded = (target: TtscProjectMutationTracker) => ({
    changes: [...target.changes],
    failed: target.failed,
    membershipChanged: target.membershipChanged,
  });

  // 1. Without filters every event is a mutation of what it names.
  const plain = tracker();
  const sink = brokeredTrackerSink(plain);
  sink.event(directory, null, "change");
  sink.event(directory, "a.ts", "change");
  assert.deepEqual(recorded(plain), {
    changes: [directory, path.join(directory, "a.ts")],
    failed: false,
    membershipChanged: true,
  });
  const placeless = tracker();
  brokeredTrackerSink(placeless).unattributed();
  assert.deepEqual(recorded(placeless), {
    changes: [],
    failed: false,
    membershipChanged: true,
  });
  const flagged = tracker();
  const flags = brokeredTrackerSink(flagged);
  flags.gap();
  assert.equal(flagged.unverified, true, "a gap leaves silence unproven");
  assert.equal(flagged.failed, false);
  flags.failed();
  assert.equal(flagged.failed, true);
  flags.unproven(new Set([directory]));
  assert.deepEqual(flagged.unproven, new Set([directory]));
  flags.unproven(undefined);
  assert.equal(flagged.unproven, undefined, "proven again");
  assert.deepEqual(flagged.changes, new Set(), "no flag is an event");

  // 2. The classifier alone decides.
  const heard: [string, string | null, string][] = [];
  const classified = tracker();
  const classify = brokeredTrackerSink(classified, {
    classify: (location, filename, eventType) => {
      heard.push([location, filename, eventType]);
      return filename === "input.d.ts"
        ? "change"
        : filename === "candidate.ts"
          ? "mutation"
          : undefined;
    },
    membership: () => true,
  });
  classify.event(directory, "cache.bin", "rename");
  assert.deepEqual(recorded(classified), recorded(tracker()));
  classify.event(directory, "input.d.ts", "change");
  assert.deepEqual(recorded(classified), {
    changes: [path.join(directory, "input.d.ts")],
    failed: false,
    membershipChanged: false,
  });
  classify.event(directory, "candidate.ts", "rename");
  assert.equal(classified.membershipChanged, true);
  assert.deepEqual(heard, [
    [directory, "cache.bin", "rename"],
    [directory, "input.d.ts", "change"],
    [directory, "candidate.ts", "rename"],
  ]);

  // 3. The project-directory filters.
  const rows: [string, string, ReturnType<typeof recorded>][] = [
    [
      "rename",
      "added.ts",
      {
        changes: [path.join(directory, "added.ts")],
        failed: false,
        membershipChanged: true,
      },
    ],
    [
      "change",
      "new.ts",
      {
        changes: [path.join(directory, "new.ts")],
        failed: false,
        membershipChanged: true,
      },
    ],
    [
      "change",
      "main.ts",
      {
        changes: [path.join(directory, "main.ts")],
        failed: false,
        membershipChanged: false,
      },
    ],
    ["rename", "bundle.js", recorded(tracker())],
    ["change", "bundle.js", recorded(tracker())],
  ];
  for (const [eventType, filename, expected] of rows) {
    const target = tracker();
    brokeredTrackerSink(target, {
      changeAddsMembership: (_location, name) => name === "new.ts",
      content: (_location, name) => name.endsWith(".ts"),
      membership: (_location, name) => name.endsWith(".ts"),
    }).event(directory, filename, eventType);
    assert.deepEqual(recorded(target), expected, `${eventType} ${filename}`);
  }
}
