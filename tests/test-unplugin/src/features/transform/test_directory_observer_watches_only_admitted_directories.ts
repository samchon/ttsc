import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { LINUX_DIRECTORY_WATCHES } from "../../../../../packages/unplugin/lib/core/transform/tracker/linux/LINUX_DIRECTORY_WATCHES.mjs";
import { openLinuxDirectoryObserver } from "../../../../../packages/unplugin/lib/core/transform/tracker/linux/openLinuxDirectoryObserver.mjs";
import { waitFor } from "../../internal/adapter-vite-serve/waitFor";

/**
 * Verifies the directory-level observer watches exactly the directories its
 * admission names, one shared watch each, and follows the tree as it changes
 * (samchon/ttsc#1389).
 *
 * Node emulates a recursive watch on Linux by walking the whole tree
 * synchronously and opening one inotify watch per file, so every capture paid
 * for all of `node_modules`. The observer replaces that emulation. It only uses
 * non-recursive watches, so the scenario runs on every POSIX platform. Windows
 * keeps every watch in its isolated broker, because an in-process watch there
 * can abort the whole process, so the scenario never opens one there.
 *
 * 1. Open two observers on one tree whose admission rejects `node_modules`, and
 *    assert only the admitted directories are watched, once each, and no file
 *    is.
 * 2. Create a directory, then a file inside it, and assert the new directory is
 *    watched and the file reported relative to the root, while a new package
 *    directory stays unwatched.
 * 3. Track a file below `node_modules` and assert exactly its directory chain
 *    joins the watch set, and a directory, which is watched itself. Then widen
 *    the admission below one package, as a project's root-file membership does
 *    (samchon/ttsc#1419), and assert only a `subtree` track watches what it now
 *    admits there.
 * 4. Close both observers and assert every shared watch is released.
 */
export async function test_directory_observer_watches_only_admitted_directories(): Promise<void> {
  if (process.platform === "win32") return;
  const root = fs.realpathSync(
    TestProject.tmpdir("ttsc-unplugin-directory-observer-"),
  );
  TestProject.writeFiles(root, {
    "src/main.ts": "export {};\n",
    "src/feature/view.ts": "export {};\n",
    ...Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [
        `node_modules/pkg-${index}/lib/index.d.ts`,
        "export {};\n",
      ]),
    ),
  });
  const at = (...segments: string[]): string => path.join(root, ...segments);
  const watchedBelowRoot = (): string[] =>
    [...LINUX_DIRECTORY_WATCHES.keys()]
      .filter((key) => key === root || key.startsWith(`${root}${path.sep}`))
      .map((key) => path.relative(root, key).replace(/\\/g, "/"))
      .sort();
  // A widened subtree is admitted too, the way a membership's walk widens a
  // scope's admission after its observer opened.
  let widened: string | undefined;
  const admit = (directory: string): boolean =>
    !directory.split(path.sep).includes("node_modules") ||
    (widened !== undefined &&
      (directory === widened || directory.startsWith(`${widened}${path.sep}`)));

  const reported: string[] = [];
  const failures: string[] = [];
  const first = openLinuxDirectoryObserver(
    root,
    admit,
    (_eventType, filename) => {
      if (filename !== null) reported.push(filename.replace(/\\/g, "/"));
    },
    () => failures.push("first"),
  );
  const second = openLinuxDirectoryObserver(
    root,
    admit,
    () => undefined,
    () => failures.push("second"),
  );
  try {
    assert.deepEqual(
      watchedBelowRoot(),
      ["", "src", "src/feature"],
      "only the admitted directories are watched, and never a file",
    );

    fs.mkdirSync(at("src", "later"));
    fs.mkdirSync(at("node_modules", "pkg-new"));
    await waitFor(
      () => watchedBelowRoot().includes("src/later"),
      "the created directory to be watched",
    );
    fs.writeFileSync(at("src", "later", "new.ts"), "export {};\n");
    await waitFor(
      () => reported.includes("src/later/new.ts"),
      "the file created in the new directory to be reported",
    );
    assert.equal(
      watchedBelowRoot().includes("node_modules/pkg-new"),
      false,
      "a directory the admission rejects is not watched when it appears",
    );

    first.track(at("node_modules", "pkg-3", "lib", "index.d.ts"));
    assert.deepEqual(
      watchedBelowRoot(),
      [
        "",
        "node_modules",
        "node_modules/pkg-3",
        "node_modules/pkg-3/lib",
        "src",
        "src/feature",
        "src/later",
      ],
      "tracking a file watches exactly the directories leading to it",
    );
    first.track(at("node_modules", "pkg-5"));
    assert.ok(
      watchedBelowRoot().includes("node_modules/pkg-5"),
      "tracking a directory watches the directory itself, whose entries a listing decides",
    );

    widened = at("node_modules", "pkg-7");
    first.track(widened);
    assert.equal(
      watchedBelowRoot().includes("node_modules/pkg-7/lib"),
      false,
      "without subtree, tracking stops at the path",
    );
    first.track(widened, true);
    assert.deepEqual(
      watchedBelowRoot().filter((key) => key.startsWith("node_modules/pkg-")),
      [
        "node_modules/pkg-3",
        "node_modules/pkg-3/lib",
        "node_modules/pkg-5",
        "node_modules/pkg-7",
        "node_modules/pkg-7/lib",
      ],
      "a subtree track watches what the widened admission now accepts below the path, and nothing beside it",
    );
    assert.deepEqual(failures, []);
  } finally {
    first.close();
    second.close();
  }
  assert.deepEqual(
    watchedBelowRoot(),
    [],
    "closing the last observer releases every shared watch",
  );
}
