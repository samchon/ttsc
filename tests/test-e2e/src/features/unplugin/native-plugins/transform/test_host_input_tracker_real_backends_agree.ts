import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import type { TtscTrackedInputScope } from "../../../../../../../packages/unplugin/lib/core/transform/tracker/TtscTrackedInputScope.mjs";
import { createHostInputMutationTracker } from "../../../../../../../packages/unplugin/lib/core/transform/tracker/createHostInputMutationTracker.mjs";
import { settleMutationTrackers } from "../../../../../../../packages/unplugin/lib/core/transform/tracker/settleMutationTrackers.mjs";
import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { settleFilesystemNotifications } from "../../../../internal/unplugin/internal/filesystem-notifications/settleFilesystemNotifications";

/**
 * Verifies the host's own watch backend records the same witnesses the shared
 * classifier decides (samchon/ttsc#1384).
 *
 * The decision table runs through a watch seam; this runs it through what the
 * operating system actually reports: inotify on Linux, FSEvents on macOS, and
 * the isolated broker process on Windows, which reports a write below a
 * directory as a content change of that directory's own entry. On Linux and
 * macOS a watch follows the directory it opened on, so replacing that directory
 * can leave the watch on its old target, so location identity must qualify its
 * authority. The replacement row here is POSIX only; Windows root replacement
 * with process cwd outside the watched directory is covered by the Vite native
 * subscription-boundary case. This exclusion makes no Windows rename-refusal
 * claim.
 *
 * 1. Track a presence-only `node_modules`, a listed type root, and a read
 *    declaration through the real backend.
 * 2. Write a test runner's cache under `node_modules`, add a type package, and
 *    edit the declaration.
 * 3. Assert only the type package and the declaration were recorded.
 * 4. On POSIX, replace the declaration's directory and assert the location check
 *    withdraws the tracker's authority.
 *
 * @evidence contracts/testing.md#behavioral-verification createHostInputMutationTracker must ignore writes beneath presence-only node_modules, record a new child of a listed type root and an edited declaration, then on POSIX withdraw authority when the watched declaration directory is replaced.
 * @evidence contracts/testing.md#independent-expectations Explicit presence/children/content scopes independently determine which mutations matter. Collected relative event paths and failed flags distinguish native-backend misclassification; the expectation is not computed by the shared classifier. This body retains its POSIX-only tracker replacement row; the Vite native subscription-boundary case independently exercises watched project-root replacement on Windows with cwd outside the moved root.
 * @evidence contracts/testing.md#distinguishing-cases Nested runner-cache writes are the no-op control, a new direct type-root child and read declaration edit are positive mutations, and unchanged versus replaced watched-directory identity tests authority. Backend events are settled before each assertion rather than assumed immediate.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_host_input_tracker_real_backends_agree in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary Actual inotify/FSEvents/broker notifications reach host-input scope classification and location verification. A watch seam alone cannot establish the filename and directory-event shapes delivered by each operating-system backend.
 * @evidence contracts/e2e.md#shared-execution One fixture and tracker lifetime batch all scope decisions over three inputs. Native backend startup is shared across mutations; the POSIX location check reuses that tracker so replacement cannot be hidden by reopening it.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A unique physical root and settled fixture creation prevent prior setup events becoming case mutations. until repeatedly settles the same tracker until the expected event is present; finally tracker.close releases its subscriptions. TestProject owns paths at runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_host_input_tracker_real_backends_agree; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_host_input_tracker_real_backends_agree(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-tracker-backend-"),
  );
  TestProject.writeFiles(
    root,
    FixtureFiles.read(
      "unplugin/host_input_tracker_real_backends_agree/inputs-1",
    ),
  );
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
