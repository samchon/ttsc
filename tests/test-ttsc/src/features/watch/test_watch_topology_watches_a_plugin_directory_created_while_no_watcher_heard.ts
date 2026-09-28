import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import {
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../internal/recorded-watchers";

/**
 * Verifies a directory created in a plugin module while no watcher heard it is
 * watched once the session re-checks its inputs.
 *
 * On macOS a directory created while libuv re-creates the FSEventStream is
 * heard by no watcher (samchon/ttsc#1583). Each directory of a plugin module
 * has a watcher of its own, and a watcher of its parent does not deliver what
 * lands in it. The re-check after a directory watch opened compared the plugin
 * inputs without syncing their watchers, and an empty directory moves no state,
 * so the directory stayed unwatched and a source written into it later rebuilt
 * nothing. The re-check now watches a directory the last sync did not know.
 *
 * 1. Resolve a project with a plugin source directory, with watchers that record
 *    their listeners instead of watching.
 * 2. Create an empty `pkg` directory in the plugin module and deliver nothing.
 * 3. Open a project-input directory watch, which schedules the re-check.
 * 4. Assert `pkg` is watched, and that a source written into it and heard by its
 *    watcher is reported.
 */
export const test_watch_topology_watches_a_plugin_directory_created_while_no_watcher_heard =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-watch-plugin-gap-directory-"),
    );
    const spec = path.join(root, "docs", "spec.md");
    const plugin = path.join(root, "plugin-go");
    const created = path.join(plugin, "pkg");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.mkdirSync(path.dirname(spec), { recursive: true });
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
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
    fs.writeFileSync(spec, "# Contract\n", "utf8");
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");

    const { restore, watchers } = recordWatchers();
    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
      },
      {
        onError: (_location, error) => {
          throw error;
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
    );
    try {
      topology.refresh(false);
      topology.setExtraInputs([plugin]);
      await settleWatchEvents();
      changes.length = 0;

      fs.mkdirSync(created);
      topology.setProjectInputs({ files: [spec], globs: [], root });
      await settleWatchEvents();
      assert.ok(
        watchers.some((watcher) => watcher.location === created),
        `a directory created while no watcher heard it was not watched: ${JSON.stringify(
          watchers.map((watcher) => watcher.location),
        )}`,
      );

      changes.length = 0;
      const source = path.join(created, "pkg.go");
      fs.writeFileSync(source, "package pkg\n", "utf8");
      deliverWatchEvent(watchers, source, "rename");
      await settleWatchEvents();
      assert.ok(
        changes.some((change) => change.kind === "plugin"),
        `a source written into that directory was not reported: ${JSON.stringify(changes)}`,
      );
    } finally {
      topology.close();
      restore();
    }
  };
