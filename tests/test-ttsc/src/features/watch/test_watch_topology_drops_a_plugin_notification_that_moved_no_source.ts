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
 * Verifies a notification about a plugin source directory is reported only when
 * what the plugin build reads moved.
 *
 * A watcher reports more than an edit. Windows reports a directory's entry as
 * changed when only its metadata moved, such as its access time after a build
 * enumerated it, and `ttsc --watch` took that as a plugin change: it rebuilt
 * the plugin and restarted the resident check host for sources nobody edited. A
 * plugin input is now decided by the digest its build keys it on.
 *
 * 1. Resolve a project whose plugin source lives in `plugin-go`, with watchers
 *    that record their listeners instead of watching.
 * 2. Deliver a `change` for the source directory's own entry while nothing in it
 *    moved, and assert no plugin change is reported.
 * 3. Edit `plugin-go/main.go` and deliver, as Windows does for one write, a
 *    `change` for the file and one for its directory's entry; assert the
 *    delivery is reported as one plugin change.
 */
export const test_watch_topology_drops_a_plugin_notification_that_moved_no_source =
  async (): Promise<void> => {
    const root = fs.realpathSync.native(
      TestProject.tmpdir("ttsc-watch-plugin-metadata-"),
    );
    const plugin = path.join(root, "plugin-go");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
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
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
      "utf8",
    );
    const source = path.join(plugin, "main.go");
    fs.writeFileSync(source, "package main\n", "utf8");

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

      deliverWatchEvent(watchers, plugin, "change");
      await settleWatchEvents();
      assert.deepEqual(
        changes.filter((change) => change.kind === "plugin"),
        [],
        "a notification that moved no plugin source was reported",
      );

      fs.writeFileSync(source, "package main\n\n// edited\n", "utf8");
      deliverWatchEvent(watchers, source, "change");
      deliverWatchEvent(watchers, plugin, "change");
      await settleWatchEvents();
      assert.equal(
        changes.filter((change) => change.kind === "plugin").length,
        1,
        JSON.stringify(changes),
      );
    } finally {
      topology.close();
      restore();
    }
  };
