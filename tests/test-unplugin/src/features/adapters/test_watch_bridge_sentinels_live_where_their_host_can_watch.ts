import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { hostToolDirectory } from "../../../../../packages/unplugin/lib/core/bridge/hostToolDirectory.js";
import { openHostWatchBridge } from "../../../../../packages/unplugin/lib/core/bridge/openHostWatchBridge.js";

/**
 * Verifies the watch bridge keeps its sentinels where every host can watch
 * them, removes them when it closes, and clears what a killed process left
 * behind (samchon/ttsc#1388, samchon/ttsc#1419, samchon/ttsc#1457).
 *
 * Turbopack fails a module whose dependency leaves its project filesystem root,
 * Farm fails a watch file it cannot relate to its root, such as one on another
 * Windows drive, and ignores one below any `node_modules`, and libuv's Windows
 * backend aborts webpack and Rspack on a watched directory spelled with a short
 * name, as the system temporary directory is (`C:\Users\RUNNER~1\...`). The
 * temporary directory, the previous default, met none of these on Windows:
 * measured on the first Windows run of the whole host suite, where webpack,
 * Rspack, Farm, and the Next dev server all died. The sentinels live in the
 * project's own `.ttsc` directory, the one place inside every host's root and
 * outside `node_modules`, spelled as the project is; the directory inside it
 * carries the owning process id, so one nothing else cleans can be removed once
 * its owner is gone.
 *
 * 1. Open a bridge with the default parent and one with an explicit parent, and
 *    assert each sentinel lives below its parent, the project's `.ttsc` by
 *    default, in a directory named for this process, removed when the bridge
 *    closes.
 * 2. Leave directories of a dead process, of this process, and of no process in
 *    the tool directory, open a bridge there, and assert only the dead
 *    process's is removed.
 */
export async function test_watch_bridge_sentinels_live_where_their_host_can_watch(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-watch-bridge-"),
  );
  const tool = hostToolDirectory(root);
  assert.equal(tool, path.join(root, ".ttsc"));
  const explicit = path.join(root, "elsewhere");
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
  const defaulted = await sentinelOf();
  assert.equal(path.dirname(defaulted), tool, "below the project's .ttsc");
  assert.match(path.basename(defaulted), named);
  const placed = await sentinelOf(explicit);
  assert.equal(path.dirname(placed), explicit);
  assert.match(path.basename(placed), named);

  const exited = spawnSync(process.execPath, ["-e", ""]).pid;
  assert.ok(exited !== undefined);
  const abandoned = path.join(tool, `ttsc-watch-bridge-${exited}-abc`);
  const live = path.join(tool, `ttsc-watch-bridge-${process.pid}-def`);
  const unowned = path.join(tool, "ttsc-watch-bridge-ghi");
  for (const directory of [abandoned, live, unowned]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  await sentinelOf();
  assert.deepEqual(
    [abandoned, live, unowned].map((directory) => fs.existsSync(directory)),
    [false, true, true],
    "only a dead process's directory is swept",
  );
}
