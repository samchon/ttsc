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
 * Verifies a same-size rewrite within the timestamp granularity is reported.
 *
 * A tracked file's modification time and size can stand still after a write on
 * FAT32, HFS+, or a coarse network filesystem. The file and directory watches
 * both know which file changed, so they must compare its bytes. A touch that
 * keeps those bytes must remain quiet.
 *
 * 1. Stamp a tracked source at a fixed whole-second time and start the watch.
 * 2. Deliver an unchanged named event and assert no compiler change.
 * 3. Rewrite the same number of bytes, restore the stamp, and require one change.
 *
 * @evidence contracts/testing.md#behavioral-verification An unchanged named event stays quiet, while a same-size rewrite with restored mtime produces exactly the tracked source path.
 * @evidence contracts/testing.md#independent-expectations Independent fixed timestamps and unequal equal-length source bytes require the named-event content comparison.
 * @evidence contracts/testing.md#distinguishing-cases An unchanged named event stays quiet, while a same-size rewrite with restored mtime produces exactly the tracked source path; the native observer's uncontrolled event scheduling remains exercised by the separate actual fs.watch watch boundaries.
 * @evidence contracts/testing.md#execution-ownership The named features/watch entry executes the shipped WatchTopology with real tsgo refresh and explicit owned subscription operations; its original assertions and subcase identities remain in this E2E population.
 * @evidence contracts/e2e.md#necessary-boundary Real tsgo refresh supplies tracked source membership before named source events; content fingerprints must detect a same-size, same-mtime edit while unchanged bytes remain quiet.
 * @evidence contracts/e2e.md#shared-execution Subcases share one E2E process, installed compiler and compiled launcher; different project origins, config transitions or membership mutations require their current compiler request. Observer registration itself installs or builds nothing.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject roots separate mutable inputs; each topology owns its supplied subscriptions and existing finally/close paths release them. Explicit providers retain the original callback and failure behavior without global observer state leaking between cases.
 * @evidence contracts/e2e.md#preserved-coverage Every original assertion and subcase input remains; the operation-provider rewrite changes only where observations are acquired, while actual compiler selection, content fingerprints, recovery and cleanup decisions remain the original semantic path.
 */
export async function test_watch_topology_reports_a_same_size_rewrite_within_the_timestamp_granularity() {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-watch-same-size-"),
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

    const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers();
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
      openFileWatch,
    );
    try {
      topology.refresh(false);
      await settleWatchEvents();
      changes.length = 0;
      deliverWatchEvent(watchers, source, "change");
      await settleWatchEvents();
      assert.equal(changes.length, 0, "unchanged bytes caused a rebuild");

      fs.writeFileSync(source, "export const value = 2;\n", "utf8");
      fs.utimesSync(source, stamp, stamp);
      assert.equal(fs.statSync(source).mtimeMs, stamp.getTime());
      deliverWatchEvent(watchers, source, "change");
      await settleWatchEvents();
      assert.deepEqual(
        changes.map((change) => change.path),
        [source],
      );
    } finally {
      topology.close();
    }
}
