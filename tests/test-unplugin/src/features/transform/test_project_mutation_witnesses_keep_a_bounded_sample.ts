import assert from "node:assert/strict";
import path from "node:path";

import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/TtscProjectMutationTracker";
import { recordProjectChange } from "../../../../../packages/unplugin/src/core/transform/tracker/recordProjectChange";
import { recordProjectMutation } from "../../../../../packages/unplugin/src/core/transform/tracker/recordProjectMutation";

/**
 * Verifies content and membership witnesses retain eight exact paths while
 * preserving the fact that a 32-path burst exceeded that diagnostic sample.
 *
 * The sample bound limits retained detail rather than invalidation. A repeated
 * retained path must not imply overflow, and content recording must not invent
 * a membership change. Native capture's retained tracker connection belongs
 * to the E2E generation-mutation-witness case.
 *
 * 1. Start independent empty content and membership trackers and record one
 *    path, then exactly eight distinct paths.
 * 2. Repeat a retained path at capacity without setting the omission flag.
 * 3. Record the ninth through thirty-second distinct paths and require the
 *    first eight plus explicit omission, preserving membership classification.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual recordProjectChange and recordProjectMutation and observes exact retained paths, omission and membership. The 32-path structural row preserves the original E2E policy assertion without reaching it through a native compiler.
 * @evidence contracts/testing.md#independent-expectations The documented eight-path diagnostic contract supplies literal size eight and authored burst-0.ts through burst-7.ts expectations. Thirty-two distinct authored paths exceed that bound; a duplicate does not. No expected result is read from an implementation constant or produced by either recorder.
 * @evidence contracts/testing.md#distinguishing-cases Empty, singleton, exactly eight, duplicate at capacity, ninth and 32-path overflow distinguish retained detail from omission. Separate content and membership rows require false versus true membership and preserve the first eight after overflow and repeated retained events. Each row owns a fresh tracker rather than reusing another generation's sample.
 * @evidence contracts/testing.md#execution-ownership This discoverable entry owns two labeled direct recorder rows over the public in-memory tracker shape. No notification authority is fabricated or consumed; no filesystem, watcher, compiler, installed artifact or product host is required. E2E retains actual native capture and retained project-tracker wiring.
 */
export async function test_project_mutation_witnesses_keep_a_bounded_sample(): Promise<void> {
  const root = path.resolve("/authored/project");
  const retained = [
    "burst-0.ts", "burst-1.ts", "burst-2.ts", "burst-3.ts",
    "burst-4.ts", "burst-5.ts", "burst-6.ts", "burst-7.ts",
  ].map((filename) => path.join(root, filename));
  const rows = [
    { label: "content", record: recordProjectChange, membership: false },
    { label: "membership", record: recordProjectMutation, membership: true },
  ];
  for (const row of rows) {
    const tracker: TtscProjectMutationTracker = {
      changes: new Set(),
      changesOmitted: false,
      close: () => undefined,
      failed: false,
      membershipChanged: false,
    };
    assert.deepEqual([...tracker.changes], [], `${row.label}: empty sample`);
    assert.equal(tracker.changesOmitted, false);
    assert.equal(tracker.membershipChanged, false);
    row.record(tracker, path.join(root, "burst-0.ts"));
    assert.deepEqual([...tracker.changes], [path.join(root, "burst-0.ts")], `${row.label}: singleton`);
    assert.equal(tracker.changesOmitted, false);
    assert.equal(tracker.membershipChanged, row.membership);
    for (let index = 1; index < 8; ++index) {
      row.record(tracker, path.join(root, `burst-${index}.ts`));
    }
    assert.deepEqual([...tracker.changes], retained, `${row.label}: exact capacity`);
    assert.equal(tracker.changes.size, 8);
    assert.equal(tracker.changesOmitted, false);
    row.record(tracker, path.join(root, "burst-0.ts"));
    assert.deepEqual([...tracker.changes], retained, `${row.label}: retained duplicate`);
    assert.equal(tracker.changesOmitted, false, `${row.label}: a duplicate is not overflow`);
    row.record(tracker, path.join(root, "burst-8.ts"));
    assert.deepEqual([...tracker.changes], retained, `${row.label}: ninth path`);
    assert.equal(tracker.changesOmitted, true);
    for (let index = 9; index < 32; ++index) {
      row.record(tracker, path.join(root, `burst-${index}.ts`));
    }
    assert.deepEqual([...tracker.changes], retained, `${row.label}: 32 distinct paths`);
    assert.equal(tracker.changes.size, 8);
    assert.equal(tracker.changesOmitted, true);
    assert.equal(tracker.membershipChanged, row.membership);
    row.record(tracker, path.join(root, "burst-7.ts"));
    assert.deepEqual([...tracker.changes], retained, `${row.label}: duplicate after overflow`);
    assert.equal(tracker.changesOmitted, true);
    assert.equal(tracker.membershipChanged, row.membership);
    assert.equal(tracker.failed, false, `${row.label}: overflow is not watch failure`);
  }
}
