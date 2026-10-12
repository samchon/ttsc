import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies an event on an existing object that resolves to nothing tracked
 * keeps the host tracker's authority, while names that could reach a tracked
 * input stay conservative.
 *
 * A recursive backend (macOS, Windows) hears every write below the project
 * root. Withdrawing authority for each of them sent every later delivery past
 * its notifications, so an edit to an unrelated asset re-proved the whole
 * snapshot and replaced generations for unrelated external edits.
 *
 * 1. Track one input beside an unrelated file, a hard-linked file and a removed
 *    file in the same directory.
 * 2. Deliver a change for the unrelated file and assert authority is kept.
 * 3. Deliver a change for the hard-linked file and a rename for the removed one,
 *    and assert each withdraws authority without a membership mutation.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual tracker classifies events delivered through its watch seam over real files.
 * @evidence contracts/testing.md#independent-expectations Real file creation, a real hard link and a real removal set which names can reach other objects; the literal unverified and membershipChanged values are the expectations.
 * @evidence contracts/testing.md#distinguishing-cases An unrelated existing file, a second name of a file and a removed name are separate rows, each on a fresh tracker.
 * @evidence contracts/testing.md#execution-ownership Unit test: real createHostInputMutationTracker over a temporary tree with a supplied watch callback; no native watcher, broker or compiler runs.
 */
export async function test_host_input_tracker_keeps_authority_for_an_existing_unrelated_object(): Promise<void> {
  const directory = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-host-tracker-unrelated-"),
  );
  const input = path.join(directory, "input.json");
  fs.writeFileSync(input, "{}");
  fs.writeFileSync(path.join(directory, "asset.txt"), "asset\n");
  fs.writeFileSync(path.join(directory, "linked.txt"), "linked\n");
  fs.linkSync(
    path.join(directory, "linked.txt"),
    path.join(directory, "second.txt"),
  );
  fs.writeFileSync(path.join(directory, "removed.txt"), "removed\n");
  fs.rmSync(path.join(directory, "removed.txt"));

  for (const [event, name, kept] of [
    ["change", "asset.txt", true],
    ["change", "second.txt", false],
    ["rename", "removed.txt", false],
  ] as const) {
    let listener:
      | ((event: string, filename: string | null) => void)
      | undefined;
    const tracker = await createHostInputMutationTracker(
      [input],
      {
        ...DEFAULT_FILESYSTEM_OPERATIONS,
        caseSensitive: () => true,
        watch: (_directory, notify) => {
          listener = notify;
          return { close: () => undefined };
        },
      },
      new Set([input]),
    );
    try {
      assert.ok(listener);
      listener(event, name);
      assert.equal(
        tracker.unverified,
        kept ? undefined : true,
        `${event} ${name}: authority`,
      );
      assert.equal(tracker.membershipChanged, false, `${event} ${name}`);
      assert.deepEqual([...tracker.changes], [], `${event} ${name}`);
    } finally {
      tracker.close();
    }
  }
}
