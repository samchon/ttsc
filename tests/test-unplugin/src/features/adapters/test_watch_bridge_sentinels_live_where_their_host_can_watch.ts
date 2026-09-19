import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { openHostWatchBridge } from "../../../../../packages/unplugin/lib/core/bridge/openHostWatchBridge.js";

/**
 * Verifies the watch bridge keeps its sentinels where the host can watch them,
 * removes them when it closes, and clears what a killed process left behind
 * (samchon/ttsc#1388, samchon/ttsc#1419).
 *
 * Farm's watcher requires an extra watch file outside the project, while
 * Turbopack fails a module whose dependency leaves its project filesystem root:
 * `next dev --turbopack` answered every page with an error while the loader's
 * sentinels lived in the system temp directory. The parent is therefore the
 * caller's, and the directory inside it carries the owning process id, so a
 * directory in a project's `node_modules/.cache`, which nothing else cleans,
 * can be removed once its owner is gone.
 *
 * 1. Open a bridge with the default parent and one with a project's tool cache,
 *    and assert each sentinel lives below its parent in a directory named for
 *    this process, removed when the bridge closes.
 * 2. Leave directories of a dead process, of this process, and of no process in
 *    the tool cache, open a bridge there, and assert only the dead process's is
 *    removed.
 */
export async function test_watch_bridge_sentinels_live_where_their_host_can_watch(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-watch-bridge-"),
  );
  const cache = path.join(root, "node_modules", ".cache", "ttsc");
  const quiet = {
    poll: () => ({ close: () => undefined }),
    watch: () => ({ close: () => undefined }),
  };
  const sentinelOf = async (parent?: string) => {
    const bridge = openHostWatchBridge(root, quiet, parent);
    const sentinel = bridge.register(path.join(root, "src", "main.ts"), [
      { file: path.join(root, "src") },
    ]);
    assert.ok(sentinel !== undefined, "a registered importer has a sentinel");
    const directory = path.dirname(sentinel);
    assert.ok(fs.existsSync(sentinel));
    await bridge.close();
    assert.equal(fs.existsSync(directory), false, "closing removes it");
    return directory;
  };

  const named = new RegExp(`^ttsc-watch-bridge-${process.pid}-`);
  const temporary = await sentinelOf();
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
  assert.match(path.basename(temporary), named);
  const cached = await sentinelOf(cache);
  assert.equal(path.dirname(cached), cache);
  assert.match(path.basename(cached), named);

  const exited = spawnSync(process.execPath, ["-e", ""]).pid;
  assert.ok(exited !== undefined);
  const abandoned = path.join(cache, `ttsc-watch-bridge-${exited}-abc`);
  const live = path.join(cache, `ttsc-watch-bridge-${process.pid}-def`);
  const unowned = path.join(cache, "ttsc-watch-bridge-ghi");
  for (const directory of [abandoned, live, unowned]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  await sentinelOf(cache);
  assert.deepEqual(
    [abandoned, live, unowned].map((directory) => fs.existsSync(directory)),
    [false, true, true],
    "only a dead process's directory is swept",
  );
}
