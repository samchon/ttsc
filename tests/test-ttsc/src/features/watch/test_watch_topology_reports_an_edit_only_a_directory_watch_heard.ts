import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import {
  recordWatchers,
  settleWatchEvents,
} from "../../internal/recorded-watchers";

/**
 * Verifies an edit to a tracked file is reported when only a directory watch
 * heard it.
 *
 * On POSIX a tracked file has a watcher of its own, and a directory watch that
 * named the file's content change left it to that watcher. On macOS the file's
 * watcher missed a `tsconfig.json` edit the root's directory watch heard, and
 * `ttsc --watch` never rebuilt (samchon/ttsc#1583). Every watcher now decides a
 * named change from the bytes, so the first to see the edit reports it once.
 *
 * 1. Resolve a project with watchers that record their listeners.
 * 2. Edit `tsconfig.json`, and deliver its `change` to the directory watchers of
 *    its parent alone, never to a watcher of the file itself.
 * 3. Assert the edit is reported once, and, where the file has a watcher of its
 *    own, a second delivery of the same bytes is not reported again.
 */
export const test_watch_topology_reports_an_edit_only_a_directory_watch_heard =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-watch-directory-only-"),
    );
    const config = path.join(root, "tsconfig.json");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: { module: "commonjs", noEmit: true, strict: true },
        include: ["src"],
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "src", "main.ts"),
      "export const value = 1;\n",
      "utf8",
    );

    const { openDirectoryWatch, restore, watchers } = recordWatchers();
    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: config,
      },
      {
        onError: (_location, error) => {
          throw error;
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
      openDirectoryWatch,
    );
    const deliverToDirectoryWatchers = (): void => {
      const directories = watchers.filter(
        (watcher) =>
          watcher.location !== config &&
          path.relative(watcher.location, config) === "tsconfig.json",
      );
      assert.notEqual(directories.length, 0, "no directory watch covers it");
      for (const watcher of directories)
        watcher.listener("change", "tsconfig.json");
    };
    try {
      topology.refresh(false);
      await settleWatchEvents();
      changes.length = 0;

      fs.writeFileSync(
        config,
        JSON.stringify({
          compilerOptions: { module: "commonjs", noEmit: true, strict: false },
          include: ["src"],
        }),
        "utf8",
      );
      deliverToDirectoryWatchers();
      await settleWatchEvents();
      assert.equal(
        changes.filter((change) => change.path === config).length,
        1,
        `an edit only a directory watch heard: ${JSON.stringify(changes)}`,
      );

      // Where the file has a watcher of its own, both decide from the bytes, so
      // hearing the same bytes again reports nothing. A backend with directory
      // watches alone uses the same fingerprint decision.
      if (!watchers.some((watcher) => watcher.location === config)) return;
      deliverToDirectoryWatchers();
      await settleWatchEvents();
      assert.equal(
        changes.filter((change) => change.path === config).length,
        1,
        `the same bytes were reported again: ${JSON.stringify(changes)}`,
      );
    } finally {
      topology.close();
      restore();
    }
  };
