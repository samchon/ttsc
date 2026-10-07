import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { createProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createProjectMutationTracker";
import { PERMISSIVE_PROJECT_MEMBERSHIP_POLICY } from "../../../../../packages/unplugin/src/core/tsconfig/PERMISSIVE_PROJECT_MEMBERSHIP_POLICY";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a project event's alias cannot keep the first target's overlap
 * authority when a later event names another actual program input.
 *
 * Project policy admits the authored source filename. Its first event records a
 * witness, unlike the host tracker's presence-only quiet case. Native alias
 * observations and actual file edits determine the independent overlap inputs.
 *
 * 1. Open a real project tracker with two covered files and permissive policy.
 * 2. Deliver the alternate name selecting A and require its witness to overlap A
 *    but not B through the tracker's actual identity callback.
 * 3. Retarget the whole supplied alias view to edited B and deliver again; require
 *    either B's overlap witness or explicit authority withdrawal.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual createProjectMutationTracker records policy-admitted alias callbacks and supplies overlaps to downstream proof consumers. The first literal A-positive/B-negative overlaps contrast with a repeated name selecting changed B; stale identity cannot certify B unchanged.
 * @evidence contracts/testing.md#independent-expectations Real A/B corpus files and one current alias mapping shared by all native operations establish each target. Literal first witness and distinct overlaps, then literal unverified-or-B-overlap, follow event and physical-identity authority without inspecting or mutating private memo maps.
 * @evidence contracts/testing.md#distinguishing-cases Same source filename and change event contrast across actual A and B targets. The first event must be recorded rather than forced quiet. Unknown alias spelling may add membership under the actual policy, so no post-event false membership expectation is imposed. Custom-watch content authority stays false and the recursive root subscription closes once.
 * @evidence contracts/testing.md#execution-ownership One source entry constructs the actual project tracker through maintained filesystem/watch capabilities and real fixture bytes. The directory snapshot only supplies admitted root discovery, not fabricated generation authority. Authored callbacks and alias mapping do not claim native alias reproduction; no compiler, native watcher or host process runs.
 */
export async function test_project_tracker_rechecks_retargeted_event_aliases(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.createProject({ "A.ts": "before A\n", "B.ts": "before B\n" }),
  );
  const first = path.join(root, "A.ts");
  const second = path.join(root, "B.ts");
  const alias = path.join(root, "EVENTALIAS.ts");
  let target = first;
  const native = (location: string): string =>
    location === alias ? target : location;
  let notify:
    | ((eventType: string, filename: string | null) => void)
    | undefined;
  let closed = 0;
  const filesystem = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    caseSensitive: () => true,
    exists: (location: string) => fs.existsSync(native(location)),
    lstat: (location: string) =>
      fs.lstatSync(native(location), { bigint: true }),
    readFile: (location: string) => fs.readFileSync(native(location)),
    readdir: (location: string) =>
      fs.readdirSync(native(location), { withFileTypes: true }),
    realpath: (location: string) => fs.realpathSync.native(native(location)),
    stat: (location: string) => fs.statSync(native(location)),
    statBigInt: (location: string) =>
      fs.statSync(native(location), { bigint: true }),
    watch: (
      directory: string,
      listener: (eventType: string, filename: string | null) => void,
      _onError?: () => void,
      recursive?: boolean,
    ) => {
      assert.equal(directory, root);
      assert.equal(recursive, true);
      notify = listener;
      return {
        close: () => {
          ++closed;
        },
      };
    },
  };
  const tracker = await createProjectMutationTracker(
    [{ path: root, relevant: true, signature: "authored root admission" }],
    new Set([first, second]),
    filesystem,
    PERMISSIVE_PROJECT_MEMBERSHIP_POLICY,
  );
  try {
    assert.equal(tracker.failed, false);
    assert.equal(tracker.contentAuthoritative, false);
    assert.equal(tracker.membershipChanged, false);
    assert.ok(notify);
    assert.ok(tracker.overlaps);
    assert.equal(filesystem.realpath(alias), first);
    notify("change", "EVENTALIAS.ts");
    assert.deepEqual([...tracker.changes], [alias]);
    assert.equal(tracker.unverified, undefined);
    assert.equal(tracker.overlaps(first, alias), true);
    assert.equal(tracker.overlaps(second, alias), false);
    target = second;
    fs.writeFileSync(second, "after B\n");
    assert.equal(filesystem.realpath(alias), second);
    assert.equal(filesystem.readFile(alias).toString(), "after B\n");
    notify("change", "EVENTALIAS.ts");
    assert.deepEqual(
      [...tracker.changes],
      [alias],
      "same reported name retains one sampled event path",
    );
    assert.equal(tracker.contentAuthoritative, false);
    if (tracker.unverified !== true) {
      assert.equal(
        tracker.overlaps(second, alias),
        true,
        "verified event authority must preserve current B overlap",
      );
    }
  } finally {
    tracker.close();
  }
  assert.equal(closed, 1);
}
