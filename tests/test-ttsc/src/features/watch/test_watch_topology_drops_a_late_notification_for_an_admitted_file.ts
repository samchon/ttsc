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
 * Verifies a named change notification that arrives after a refresh admitted
 * its file is dropped when the file still holds the admitted bytes, and
 * reported when it does not.
 *
 * On Windows the recursive watcher reports a new file's creation and its first
 * write as separate events. The creation refreshed the topology, whose rebuild
 * compiled the file, and the write's `change`, arriving after that rebuild read
 * it, was taken at its word: `ttsc --watch` rebuilt a second time for a change
 * the first rebuild already read (samchon/ttsc#1580). A refresh now
 * acknowledges each file it admits by its content.
 *
 * 1. Resolve a project whose `src` holds one file, with watchers that record their
 *    listeners instead of watching.
 * 2. Create `src/later/value.ts` and deliver the new directory's creation to the
 *    watchers that observe it: the refresh admits the file and reports a
 *    topology change.
 * 3. Move its metadata without changing its bytes, then deliver a late
 *    `change` to every watcher that observes it. Assert nothing is reported.
 * 4. Write other bytes, deliver a `change` again, and assert it is reported once.
 */
export const test_watch_topology_drops_a_late_notification_for_an_admitted_file =
  async (): Promise<void> => {
    const root = fs.realpathSync.native(
      TestProject.tmpdir("ttsc-watch-late-notification-"),
    );
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { module: "commonjs", noEmit: true, strict: true },
        include: ["src"],
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "src", "seed.ts"),
      "export const seed = 1;\n",
      "utf8",
    );

    const { openDirectoryWatch, restore, watchers } = recordWatchers();
    const changes: WatchInputChange[] = [];
    let topologyChanges = 0;
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
        onTopologyChange: () => {
          topologyChanges += 1;
        },
      },
      openDirectoryWatch,
    );
    try {
      topology.refresh(false);
      await settleWatchEvents();
      changes.length = 0;
      topologyChanges = 0;

      const value = path.join(root, "src", "later", "value.ts");
      fs.mkdirSync(path.dirname(value));
      fs.writeFileSync(value, "export const value = 1;\n", "utf8");
      deliverWatchEvent(watchers, path.dirname(value), "rename");
      await settleWatchEvents();
      assert.equal(topologyChanges, 1, "the creation did not admit the file");
      assert.deepEqual([...changes], []);

      fs.utimesSync(value, new Date(0), new Date(0));
      deliverWatchEvent(watchers, value, "change");
      await settleWatchEvents();
      assert.deepEqual(
        [...changes],
        [],
        "a notification for bytes the refresh admitted was reported",
      );

      fs.writeFileSync(value, "export const value = 2;\n", "utf8");
      deliverWatchEvent(watchers, value, "change");
      await settleWatchEvents();
      assert.deepEqual(
        changes.map((change) => change.path),
        [value],
        "an edit after admission was not reported",
      );
    } finally {
      topology.close();
      restore();
    }
  };
