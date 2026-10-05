import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import { walkProjectInputs } from "../../../../../../../packages/unplugin/lib/core/transform/project/walkProjectInputs.mjs";
import { createHostInputMutationTracker } from "../../../../../../../packages/unplugin/lib/core/transform/tracker/createHostInputMutationTracker.mjs";
import { createProjectMutationTracker } from "../../../../../../../packages/unplugin/lib/core/transform/tracker/createProjectMutationTracker.mjs";
import { LINUX_DIRECTORY_WATCHES } from "../../../../../../../packages/unplugin/lib/core/transform/tracker/linux/LINUX_DIRECTORY_WATCHES.mjs";
import { readProjectMembershipPolicy } from "../../../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.mjs";
import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { waitFor } from "../../../../internal/unplugin/internal/adapter-vite-serve/waitFor";

/**
 * Verifies the Linux trackers' watch set is fixed by the project and its
 * tracked inputs, never by the size of `node_modules` (samchon/ttsc#1389).
 *
 * Node's recursive `fs.watch` on Linux walks the whole root synchronously and
 * opens one inotify watch per file, so a capture's cost and watch count grew
 * with every installed package, up to the per-user limit, past which the
 * generation silently lost its notification proof. macOS and Windows notify
 * recursively in the kernel and never take this path, so the scenario asserts
 * on Linux only, where every watch lives in the native binary's watch helper
 * (samchon/ttsc#1426).
 *
 * 1. Open the project tracker over a project with 5 packages, and again with 500,
 *    and assert both open the same watches, none below `node_modules`.
 * 2. Track an input inside one package and assert only its directory chain is
 *    added.
 * 3. Create a source directory, then a source in it, and assert the tracker
 *    watches the directory and hears the source as a membership change.
 * 4. Make a project directory unwatchable and assert the tracker fails cleanly
 *    instead of throwing.
 *
 * @evidence contracts/testing.md#behavioral-verification Project trackers over five and five hundred packages must expose the same root/src watch set; a tracked package input adds only its directory chain, new src directories become watched and report source membership, and an unwatchable directory must fail cleanly.
 * @evidence contracts/testing.md#independent-expectations The literal root/src set and tracked package chain follow admitted project membership, independently of recursive watcher implementation. Equality across a hundredfold package count measures native resource cardinality. The permissions failure row is unavailable to root, whose filesystem privileges defeat the stimulus.
 * @evidence contracts/testing.md#distinguishing-cases Five versus five hundred untracked packages, one explicitly tracked package, a newly created source directory and source, and unprivileged unreadable-directory startup are the owned differences. The Linux guard limits this native watch-set oracle to inotify.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_linux_trackers_watch_no_package_tree in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary Real Linux tracker construction opens native helper watches and hears new-directory filesystem events. Direct admission calls cannot demonstrate bounded native watch allocation, subscription extension or clean native startup failure.
 * @evidence contracts/e2e.md#shared-execution The five-package tracker closes before the five-hundred-package tracker opens on the same growing fixture, preserving comparable owner counts. The latter shares watches with its one host-input tracker. All phases reuse the helper and fixture; growth changes case input rather than installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Watch-map inspection is restricted to the unique physical root. Nested finally blocks close input and project trackers, and chmod is restored in finally after the failure row. Root runs explicitly omit that ineffective permissions row; TestProject owns directories through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_linux_trackers_watch_no_package_tree; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_linux_trackers_watch_no_package_tree(): Promise<void> {
  if (process.platform !== "linux") return;
  const root = fs.realpathSync(
    TestProject.tmpdir("ttsc-unplugin-linux-watch-set-"),
  );
  const at = (...segments: string[]): string => path.join(root, ...segments);
  const plantPackages = (count: number): void => {
    for (let index = 0; index < count; index += 1) {
      const lib = at("node_modules", `pkg-${index}`, "lib");
      fs.mkdirSync(lib, { recursive: true });
      fs.writeFileSync(path.join(lib, "index.d.ts"), "export {};\n");
      fs.writeFileSync(path.join(lib, "index.js"), "export {};\n");
    }
  };
  TestProject.writeFiles(
    root,
    FixtureFiles.read("unplugin/linux_trackers_watch_no_package_tree/inputs-1"),
  );
  const policy = readProjectMembershipPolicy(at("tsconfig.json"));
  const watched = (): string[] =>
    [...LINUX_DIRECTORY_WATCHES.keys()]
      .filter((key) => key === root || key.startsWith(`${root}${path.sep}`))
      .map((key) => path.relative(root, key))
      .sort();
  const openProjectTracker = () =>
    createProjectMutationTracker(
      walkProjectInputs(root, DEFAULT_FILESYSTEM_OPERATIONS, policy)
        .directories,
      new Set(),
      DEFAULT_FILESYSTEM_OPERATIONS,
      policy,
    );

  plantPackages(5);
  const few = await openProjectTracker();
  const fewWatched = watched();
  few.close();
  plantPackages(500);
  const many = await openProjectTracker();
  try {
    assert.deepEqual(
      watched(),
      fewWatched,
      "a hundredfold `node_modules` opens not one more watch",
    );
    assert.deepEqual(fewWatched, ["", "src", "src/feature"]);

    const input = await createHostInputMutationTracker(
      [at("node_modules", "pkg-7", "lib", "index.d.ts"), at("src", "main.ts")],
      DEFAULT_FILESYSTEM_OPERATIONS,
      new Set(),
      "all",
      root,
    );
    try {
      assert.deepEqual(
        watched(),
        [
          "",
          "node_modules",
          "node_modules/pkg-7",
          "node_modules/pkg-7/lib",
          "src",
          "src/feature",
        ],
        "a tracked package input adds exactly the directories leading to it",
      );
      assert.equal(input.failed, false);
    } finally {
      input.close();
    }

    fs.mkdirSync(at("src", "later"));
    await waitFor(
      () => watched().includes("src/later"),
      "the created source directory to be watched",
    );
    const added = at("src", "later", "added.ts");
    fs.writeFileSync(added, "export {};\n");
    await waitFor(
      () => many.changes.has(added),
      "the source created in the new directory to be heard",
    );
    assert.equal(many.membershipChanged, true);
    assert.equal(many.failed, false);
  } finally {
    many.close();
  }

  // Root ignores directory permissions, so only an unprivileged run can make a
  // directory unwatchable.
  if (process.getuid?.() === 0) return;
  fs.mkdirSync(at("src", "locked"));
  fs.chmodSync(at("src", "locked"), 0o000);
  try {
    const locked = await openProjectTracker();
    try {
      assert.equal(
        locked.failed,
        true,
        "an unwatchable directory fails the tracker instead of throwing",
      );
    } finally {
      locked.close();
    }
  } finally {
    fs.chmodSync(at("src", "locked"), 0o755);
  }
}
