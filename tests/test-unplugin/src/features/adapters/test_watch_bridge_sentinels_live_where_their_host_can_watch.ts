import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { hostToolDirectory } from "../../../../../packages/unplugin/lib/core/bridge/hostToolDirectory.js";
import { openHostWatchBridge } from "../../../../../packages/unplugin/lib/core/bridge/openHostWatchBridge.js";

/**
 * Verifies the watch bridge keeps its sentinels where every host can watch
 * them, keeps them across sessions, and clears what a killed process left
 * behind of what may not outlive it (samchon/ttsc#1388, samchon/ttsc#1419,
 * samchon/ttsc#1457, samchon/ttsc#1468).
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
 * outside `node_modules`, spelled as the project is. A sentinel is a dependency
 * a host's persistent cache records, so it stays when the bridge closes and a
 * later bridge registers the same importer without touching it; only a signal
 * rewrites it, with bytes no earlier write left. The per-process directories
 * beside it hold what may not outlive a process, and one whose owner is gone is
 * swept.
 *
 * 1. Open a bridge with the default parent and one with an explicit parent,
 *    register an importer in each, and assert its sentinel lives below the
 *    parent, the project's `.ttsc` by default, and survives the bridge
 *    closing.
 * 2. Open a bridge again over the surviving sentinel, register the importer, and
 *    assert the file is untouched.
 * 3. Leave directories of a dead process, of this process, and of no process in
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
  const importer = path.join(root, "src", "main.ts");
  const sentinelOf = async (parent?: string) => {
    const bridge = openHostWatchBridge(root, quiet, parent);
    const sentinel = bridge.register(importer, [
      { file: path.join(root, "src") },
    ]);
    assert.ok(sentinel !== undefined, "a registered importer has a sentinel");
    assert.ok(fs.existsSync(sentinel));
    await bridge.close();
    assert.ok(fs.existsSync(sentinel), "closing leaves the sentinel");
    return sentinel;
  };

  const defaulted = await sentinelOf();
  assert.equal(
    path.dirname(defaulted),
    path.join(tool, "watch-bridge"),
    "below the project's .ttsc, under one name for every session",
  );
  const placed = await sentinelOf(explicit);
  assert.equal(path.dirname(placed), path.join(explicit, "watch-bridge"));

  const before = fs.statSync(defaulted, { bigint: true });
  const content = fs.readFileSync(defaulted, "utf8");
  const again = openHostWatchBridge(root, quiet);
  assert.equal(
    again.register(importer, [{ file: path.join(root, "src") }]),
    defaulted,
  );
  const after = fs.statSync(defaulted, { bigint: true });
  assert.equal(after.mtimeNs, before.mtimeNs, "a registration writes nothing");
  assert.equal(fs.readFileSync(defaulted, "utf8"), content);
  await again.close();

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
