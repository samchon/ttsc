import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import type { TtscTrackedInputScope } from "../../../../../packages/unplugin/lib/core/transform/tracker/TtscTrackedInputScope.mjs";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/createHostInputMutationTracker.mjs";
import { settleMutationTrackers } from "../../../../../packages/unplugin/lib/core/transform/tracker/settleMutationTrackers.mjs";
import { settleFilesystemNotifications } from "../../internal/filesystem-notifications/settleFilesystemNotifications";

/**
 * Verifies the host's own watch backend records the same witnesses the shared
 * classifier decides (samchon/ttsc#1384).
 *
 * The decision table runs through a watch seam; this runs it through what the
 * operating system actually reports: inotify on Linux, FSEvents on macOS, and
 * the isolated broker process on Windows, which reports a write below a
 * directory as a content change of that directory's own entry. On Linux and
 * macOS a watch follows the directory it opened on, so replacing that directory
 * produces no event at all and only the location identity check can notice it;
 * Windows refuses to rename a watched directory, so that row is POSIX only.
 *
 * 1. Track a presence-only `node_modules`, a listed type root, and a read
 *    declaration through the real backend.
 * 2. Write a test runner's cache under `node_modules`, add a type package, and
 *    edit the declaration.
 * 3. Assert only the type package and the declaration were recorded.
 * 4. On POSIX, replace the declaration's directory and assert the location check
 *    withdraws the tracker's authority.
 */
export async function test_host_input_tracker_real_backends_agree(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-tracker-backend-"),
  );
  TestProject.writeFiles(root, {
    "lib/types.d.ts": "export declare const version: 1;\n",
    "node_modules/pkg/index.d.ts": "export {};\n",
    "types/existing/index.d.ts": "export {};\n",
  });
  // The fixture's own creation must not reach the new watches as events.
  await settleFilesystemNotifications();
  const at = (...segments: string[]): string => path.join(root, ...segments);
  const scopes = new Map<string, TtscTrackedInputScope>([
    [at("node_modules"), "presence"],
    [at("types"), "children"],
    [at("lib", "types.d.ts"), "content"],
  ]);
  const inputs = [...scopes.keys()];
  const tracker = await createHostInputMutationTracker(
    inputs,
    DEFAULT_FILESYSTEM_OPERATIONS,
    new Set(inputs),
    "all",
    undefined,
    scopes,
  );
  /** Settle until `done` holds, so a slow backend is waited for, not raced. */
  const until = async (done: () => boolean, label: string): Promise<void> => {
    const deadline = Date.now() + 10_000;
    for (;;) {
      await settleMutationTrackers([tracker]);
      if (done()) return;
      assert.ok(Date.now() < deadline, `timed out waiting for ${label}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };
  const recorded = (): string[] =>
    [...tracker.changes].map((changed) =>
      path.relative(root, changed).replaceAll(path.sep, "/"),
    );
  try {
    assert.equal(tracker.failed, false, "the backend must open its watches");
    TestProject.writeFiles(root, {
      "node_modules/.vitest-cache/results.json": "{}",
      "node_modules/.vite-temp/config.timestamp.mjs": "export {};\n",
    });
    fs.mkdirSync(at("types", "added"));
    await until(
      () => recorded().includes("types/added"),
      "the added type package",
    );
    fs.writeFileSync(
      at("lib", "types.d.ts"),
      "export declare const version: 2;\n",
    );
    await until(
      () => recorded().includes("lib/types.d.ts"),
      "the declaration edit",
    );
    assert.deepEqual(
      recorded()
        .filter((changed) => changed.startsWith("node_modules"))
        .sort(),
      [],
      `writes below a presence-only directory must record nothing, but ${JSON.stringify(recorded())} were recorded`,
    );

    if (process.platform !== "win32") {
      tracker.verifyLocations?.();
      assert.equal(tracker.failed, false, "unchanged locations hold");
      await TestProject.rename(at("lib"), at("lib-old"));
      fs.mkdirSync(at("lib"));
      fs.writeFileSync(
        at("lib", "types.d.ts"),
        "export declare const version: 3;\n",
      );
      await settleMutationTrackers([tracker]);
      tracker.verifyLocations?.();
      assert.equal(
        tracker.failed,
        true,
        "a replaced watched directory must withdraw the tracker's authority",
      );
    }
  } finally {
    tracker.close();
  }
}
