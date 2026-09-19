import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import { walkProjectInputs } from "../../../../../packages/unplugin/lib/core/transform/project/walkProjectInputs.mjs";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/createHostInputMutationTracker.mjs";
import { createProjectMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/createProjectMutationTracker.mjs";
import { LINUX_WATCH_HELPER } from "../../../../../packages/unplugin/lib/core/transform/tracker/linux/LINUX_WATCH_HELPER.mjs";
import { drainLinuxWatchHelper } from "../../../../../packages/unplugin/lib/core/transform/tracker/linux/drainLinuxWatchHelper.mjs";
import { routeLinuxWatchHelperLine } from "../../../../../packages/unplugin/lib/core/transform/tracker/linux/routeLinuxWatchHelperLine.mjs";
import { settleMutationTrackers } from "../../../../../packages/unplugin/lib/core/transform/tracker/settleMutationTrackers.mjs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.mjs";

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
 */
export async function test_linux_watch_helper_keeps_every_watch_honest(): Promise<void> {
  if (process.platform !== "linux") return;
  const root = fs.realpathSync(
    TestProject.tmpdir("ttsc-unplugin-linux-watch-helper-"),
  );
  const at = (...segments: string[]): string => path.join(root, ...segments);
  TestProject.writeFiles(root, {
    "src/main.ts": "export {};\n",
    "types/global.d.ts": "declare const version: 1;\n",
    "tsconfig.json": JSON.stringify({ include: ["src", "types"] }),
  });
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
