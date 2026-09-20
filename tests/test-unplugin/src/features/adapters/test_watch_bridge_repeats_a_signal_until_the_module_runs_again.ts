import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { openHostWatchBridge } from "../../../../../packages/unplugin/lib/core/bridge/openHostWatchBridge.js";

/**
 * Verifies a bridge opened to confirm delivery keeps rewriting a stale module's
 * sentinel until a registration proves the module delivered the current state,
 * and stops then (samchon/ttsc#1423).
 *
 * Turbopack takes a loader dependency's state as its baseline only when the
 * loader returns. A sentinel rewritten before then is part of that baseline, so
 * a change landing between the compile's read and the baseline never re-ran the
 * module, and the page kept the older output. A run that merely started proves
 * nothing either: measured on real `next dev`, a run that began before the
 * change read the old state, and stopping the rewrites for it left one module
 * of four on the old value.
 *
 * 1. Register a module whose recorded input no longer holds on a bridge that does
 *    not confirm, and assert the sentinel is rewritten at once.
 * 2. Do the same on a confirming bridge, and assert the sentinel is rewritten
 *    after a delay, and again later.
 * 3. Register the module again with the same stale state, as a run that read the
 *    old state does, and assert the rewrites go on; then register it with the
 *    input's current state and assert they stop.
 * 4. Close a bridge with rewrites still owed, and assert it writes nothing more.
 */
export async function test_watch_bridge_repeats_a_signal_until_the_module_runs_again(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-watch-bridge-confirm-"),
  );
  const cache = path.join(root, ".ttsc");
  const quiet = {
    poll: () => ({ close: () => undefined }),
    watch: () => ({ close: () => undefined }),
  };
  const importer = path.join(root, "src", "main.ts");
  const declaration = path.join(root, "src", "types.d.ts");
  // What a delivery recorded of the declaration: read, or found missing.
  const recorded = (exists: boolean) => [
    {
      evidence: {
        identity: declaration,
        missing: !exists,
        state: {
          codec: "predicates" as const,
          observation: { fileExists: exists },
        },
      },
      file: declaration,
    },
  ];
  // The declaration does not exist, so a delivery that read it is stale.
  const stale = recorded(true);
  const current = recorded(false);
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
  assert.notEqual(second, first, "the signal repeats");

  confirming.register(importer, stale);
  await wait(150);
  const third = contents();
  assert.notEqual(
    third,
    second,
    "a registration that read the old state is signalled again at once",
  );
  confirming.register(importer, current);
  await wait(1_200);
  assert.equal(
    contents(),
    third,
    "a registration that read the current state stops the rewrites",
  );

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
