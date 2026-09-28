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
 * Verifies an unnamed backend gap rechecks bytes despite an unchanged stamp.
 *
 * FSEvents reports when it dropped events, but metadata alone cannot answer a
 * same-size rewrite inside a filesystem clock tick. A gap must compare every
 * tracked candidate's content with its last observed fingerprint. A gap with no
 * changed bytes must not start a build.
 *
 * 1. Stamp a source at a fixed time and start recorded directory watches.
 * 2. Deliver an unnamed gap with no edit and assert no change.
 * 3. Rewrite the same number of bytes, restore the time, and require one change.
 */
export const test_watch_topology_rechecks_file_bytes_after_a_directory_gap =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-watch-gap-"),
    );
    const config = path.join(root, "tsconfig.json");
    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: { module: "commonjs", noEmit: true, strict: true },
        include: ["src"],
      }),
      "utf8",
    );
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    const stamp = new Date(Math.floor(Date.now() / 1000) * 1000 - 60_000);
    fs.utimesSync(source, stamp, stamp);

    const { openDirectoryWatch, restore, watchers } = recordWatchers();
    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      { cwd: root, files: [], projectRoot: root, tsconfig: config },
      {
        onError: (_location, error) => {
          throw error;
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
      openDirectoryWatch,
    );
    const gap = (): void => {
      const observing = watchers.filter(
        (watcher) =>
          watcher.active &&
          watcher.location !== source &&
          !path.relative(watcher.location, source).startsWith(".."),
      );
      assert.ok(observing.length > 0, "no directory watch covers the source");
      for (const watcher of observing) watcher.listener("rename", null);
    };
    try {
      topology.refresh(false);
      await settleWatchEvents();
      changes.length = 0;
      gap();
      await settleWatchEvents();
      assert.equal(changes.length, 0, "an empty gap caused a rebuild");

      fs.writeFileSync(source, "export const value = 2;\n", "utf8");
      fs.utimesSync(source, stamp, stamp);
      assert.equal(fs.statSync(source).mtimeMs, stamp.getTime());
      gap();
      await settleWatchEvents();
      assert.deepEqual(
        changes.map((change) => change.path),
        [source],
      );
    } finally {
      topology.close();
      restore();
    }
  };
