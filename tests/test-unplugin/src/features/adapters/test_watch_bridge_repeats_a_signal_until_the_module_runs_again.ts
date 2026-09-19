import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { openHostWatchBridge } from "../../../../../packages/unplugin/lib/core/bridge/openHostWatchBridge.js";

/**
 * Verifies a bridge opened to confirm delivery keeps rewriting a stale module's
 * sentinel until the module runs again, and stops then (samchon/ttsc#1423).
 *
 * Turbopack takes a loader dependency's state as its baseline only when the
 * loader returns. A sentinel rewritten before then is part of that baseline, so
 * a change landing between the compile's read and the baseline never re-ran the
 * module, and the page kept the older output.
 *
 * 1. Register a module whose recorded input no longer holds on a bridge that does
 *    not confirm, and assert the sentinel is rewritten at once.
 * 2. Do the same on a confirming bridge, and assert the sentinel is rewritten
 *    after a delay, again later, and never after the module is acknowledged.
 * 3. Acknowledge a stale module before its first rewrite, on the same bridge and
 *    on another one sharing the directory, as another worker of the host would,
 *    and close a bridge with rewrites still owed, and assert none of them
 *    writes anything more.
 */
export async function test_watch_bridge_repeats_a_signal_until_the_module_runs_again(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-watch-bridge-confirm-"),
  );
  const cache = path.join(root, "node_modules", ".cache", "ttsc");
  const quiet = {
    poll: () => ({ close: () => undefined }),
    watch: () => ({ close: () => undefined }),
  };
  const importer = path.join(root, "src", "main.ts");
  // The compile saw this declaration, which no longer exists.
  const stale = [
    {
      evidence: {
        identity: path.join(root, "src", "types.d.ts"),
        missing: false,
        state: {
          codec: "predicates" as const,
          observation: { fileExists: true },
        },
      },
      file: path.join(root, "src", "types.d.ts"),
    },
  ];
  const wait = (milliseconds: number) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

  const immediate = openHostWatchBridge(root, quiet, cache);
  const signalled = immediate.register(importer, stale)!;
  assert.notEqual(
    fs.readFileSync(signalled, "utf8"),
    "0",
    "a bridge that does not confirm signals at once",
  );
  await immediate.close();

  const confirming = openHostWatchBridge(root, quiet, cache, true);
  const sentinel = confirming.register(importer, stale)!;
  const contents = () => fs.readFileSync(sentinel, "utf8");
  assert.equal(contents(), "0", "the first rewrite waits");
  await wait(150);
  const first = contents();
  assert.notEqual(first, "0", "the first rewrite lands");
  await wait(250);
  const second = contents();
  assert.notEqual(second, first, "the signal repeats until acknowledged");
  confirming.acknowledge(importer);
  await wait(900);
  assert.equal(contents(), second, "an acknowledged module stops the rewrites");

  confirming.register(importer, stale);
  confirming.acknowledge(importer);
  await wait(400);
  assert.equal(contents(), second, "an early acknowledgement writes nothing");
  const worker = openHostWatchBridge(root, quiet, cache, true);
  confirming.register(importer, stale);
  worker.acknowledge(importer);
  await wait(400);
  assert.equal(contents(), second, "a run in another worker answers it too");
  await worker.close();

  confirming.register(path.join(root, "src", "other.ts"), stale);
  const directory = path.dirname(sentinel);
  await confirming.close();
  await wait(400);
  assert.equal(fs.existsSync(directory), false);
  assert.deepEqual(
    fs
      .readdirSync(cache)
      .filter((name) => name.startsWith(`ttsc-watch-bridge-${process.pid}-`)),
    [],
    "a closed bridge writes no owed rewrite",
  );
}
