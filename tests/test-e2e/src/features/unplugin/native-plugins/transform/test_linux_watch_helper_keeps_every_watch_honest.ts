import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import { walkProjectInputs } from "../../../../../../../packages/unplugin/lib/core/transform/project/walkProjectInputs.mjs";
import { createHostInputMutationTracker } from "../../../../../../../packages/unplugin/lib/core/transform/tracker/createHostInputMutationTracker.mjs";
import { createProjectMutationTracker } from "../../../../../../../packages/unplugin/lib/core/transform/tracker/createProjectMutationTracker.mjs";
import { LINUX_WATCH_HELPER } from "../../../../../../../packages/unplugin/lib/core/transform/tracker/linux/LINUX_WATCH_HELPER.mjs";
import { drainLinuxWatchHelper } from "../../../../../../../packages/unplugin/lib/core/transform/tracker/linux/drainLinuxWatchHelper.mjs";
import { routeLinuxWatchHelperLine } from "../../../../../../../packages/unplugin/lib/core/transform/tracker/linux/routeLinuxWatchHelperLine.mjs";
import { settleMutationTrackers } from "../../../../../../../packages/unplugin/lib/core/transform/tracker/settleMutationTrackers.mjs";
import { readProjectMembershipPolicy } from "../../../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.mjs";
import { FixtureFiles } from "../../../../internal/FixtureFiles";

/**
 * Verifies every Linux watch lives in the native binary's watch helper, hears
 * an edit before a delivery reads it, and stops vouching for anything once the
 * helper reports dropped events or goes away (samchon/ttsc#1426).
 *
 * An inotify queue drops events once full and says so with one IN_Q_OVERFLOW
 * event, which libuv discards, so a watch opened through `fs.watch` could lose
 * events without notice, and the adapter read that silence as proof. The helper
 * reports the overflow, and answers a sync only after reading its queue empty.
 *
 * 1. Open a project tracker and a host-input tracker, and assert both are live and
 *    drain through the helper.
 * 2. Create a source and edit an input, settle once, and assert both trackers
 *    already recorded them.
 * 3. Report an overflow through the running helper, and assert both trackers
 *    record an unattributed mutation.
 * 4. Stop the helper, and assert both trackers fail and a drain proves nothing;
 *    then point the adapter at a binary that does not exist, and assert a new
 *    tracker fails instead of trusting a watch.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual project and host-input trackers must become live through drainLinuxWatchHelper, record filesystem writes after one settle, treat a routed overflow as unattributed membership mutation, fail when the running helper exits, and refuse a missing helper binary.
 * @evidence contracts/testing.md#independent-expectations Literal live/failed states and source/declaration paths follow the notification-authority contract. The overflow protocol message is deliberate input with an independently required conservative mutation; it does not simulate actual kernel queue exhaustion, which remains outside this oracle.
 * @evidence contracts/testing.md#distinguishing-cases Healthy synchronized edits contrast with protocol overflow, actual helper termination and missing-binary startup. Both tracker kinds must withdraw authority together, and a drain after termination must return false. This connection is Linux-specific.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_linux_watch_helper_keeps_every_watch_honest in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The JS trackers share a real native helper process and its sync/exit protocol. Unit routing can test an overflow message, but cannot show actual drain barriers observe filesystem writes or that native process termination invalidates every owner.
 * @evidence contracts/e2e.md#shared-execution One running helper serves both trackers and both writes. Overflow is injected into that session; its real termination is necessary to test lost-process authority. The separate missing-binary attempt changes startup input and must not adopt the prior helper.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique physical fixture paths isolate event names. The killed helper is temporarily referenced while awaiting exit; finally closes both trackers. The TTSC_BINARY override is restored and the refused missing path removed in finally, preventing later cases inheriting deliberate startup failure; TestProject owns temporary roots.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_linux_watch_helper_keeps_every_watch_honest; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_linux_watch_helper_keeps_every_watch_honest(): Promise<void> {
  if (process.platform !== "linux") return;
  const root = fs.realpathSync(
    TestProject.tmpdir("ttsc-unplugin-linux-watch-helper-"),
  );
  const at = (...segments: string[]): string => path.join(root, ...segments);
  TestProject.writeFiles(
    root,
    FixtureFiles.read(
      "unplugin/linux_watch_helper_keeps_every_watch_honest/inputs-1",
    ),
  );
  const policy = readProjectMembershipPolicy(at("tsconfig.json"));
  const openTrackers = async () => {
    const project = await createProjectMutationTracker(
      walkProjectInputs(root, DEFAULT_FILESYSTEM_OPERATIONS, policy)
        .directories,
      new Set(),
      DEFAULT_FILESYSTEM_OPERATIONS,
      policy,
    );
    const input = await createHostInputMutationTracker(
      [at("types", "global.d.ts")],
      DEFAULT_FILESYSTEM_OPERATIONS,
      new Set(),
      "all",
      root,
    );
    return { input, project };
  };

  const { input, project } = await openTrackers();
  try {
    assert.deepEqual(
      [project.failed, input.failed],
      [false, false],
      "both trackers go live through the helper",
    );
    assert.equal(project.drain, drainLinuxWatchHelper);
    assert.equal(input.drain, drainLinuxWatchHelper);

    fs.writeFileSync(at("src", "added.ts"), "export {};\n");
    fs.writeFileSync(at("types", "global.d.ts"), "declare const version: 2;\n");
    await settleMutationTrackers([project, input]);
    assert.equal(project.changes.has(at("src", "added.ts")), true);
    assert.equal(project.membershipChanged, true);
    assert.equal(input.changes.has(at("types", "global.d.ts")), true);
    assert.equal(project.unverified, undefined, "the sync was answered");

    project.membershipChanged = false;
    input.membershipChanged = false;
    const helper = LINUX_WATCH_HELPER.current;
    assert.ok(helper !== undefined, "the helper is running");
    routeLinuxWatchHelperLine(helper, '{"overflow":true}');
    assert.deepEqual(
      [project.membershipChanged, input.membershipChanged],
      [true, true],
      "an overflow is a mutation for every tracker",
    );

    // An idle helper is unreferenced so it never keeps a host alive; the
    // scenario holds it while it waits for the exit it caused.
    helper.child.ref();
    const exited = new Promise((resolve) => helper.child.once("exit", resolve));
    helper.child.kill();
    await exited;
    assert.deepEqual(
      [project.failed, input.failed],
      [true, true],
      "a helper that went away fails every tracker it served",
    );
    assert.equal(await drainLinuxWatchHelper(), false);
  } finally {
    input.close();
    project.close();
  }

  const binary = process.env.TTSC_BINARY;
  process.env.TTSC_BINARY = at("missing", "ttsc");
  try {
    const orphan = await openTrackers();
    try {
      assert.deepEqual(
        [orphan.project.failed, orphan.input.failed],
        [true, true],
        "without a helper, no Linux watch is trusted",
      );
    } finally {
      orphan.input.close();
      orphan.project.close();
    }
  } finally {
    if (binary === undefined) delete process.env.TTSC_BINARY;
    else process.env.TTSC_BINARY = binary;
    LINUX_WATCH_HELPER.refused.delete(at("missing", "ttsc"));
  }
}
