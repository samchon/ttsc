import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import { walkProjectInputs } from "../../../../../packages/unplugin/lib/core/transform/project/walkProjectInputs.mjs";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/createHostInputMutationTracker.mjs";
import { createProjectMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/createProjectMutationTracker.mjs";
import { LINUX_DIRECTORY_WATCHES } from "../../../../../packages/unplugin/lib/core/transform/tracker/linux/LINUX_DIRECTORY_WATCHES.mjs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.mjs";
import { waitFor } from "../../internal/adapter-vite-serve/waitFor";

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
  TestProject.writeFiles(root, {
    "src/main.ts": "export {};\n",
    "src/feature/view.ts": "export {};\n",
    "tsconfig.json": JSON.stringify({ include: ["src"] }),
  });
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
