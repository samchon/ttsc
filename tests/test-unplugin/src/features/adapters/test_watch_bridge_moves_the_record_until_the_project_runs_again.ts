import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { openHostWatchBridge } from "../../../../../packages/unplugin/lib/core/bridge/openHostWatchBridge.js";
import { projectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/projectRecordFile.js";
import { readProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/readProjectRecordFile.js";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/writeProjectRecordFile.js";

/**
 * Verifies the bridge moves a project's record at once when a registered
 * delivery read a state that no longer holds, keeps moving it until a
 * registration proves a delivery read the current state, and stops then
 * (samchon/ttsc#1423).
 *
 * A host takes a file's state as its baseline at a moment of its own: Turbopack
 * when the loader returns, Rspack when its watcher records the time after a
 * build, Rolldown after the build a change landed in. A record moved before
 * that moment is part of the baseline, so the move is repeated with a growing
 * delay until a registration answers it. A run that merely started proves
 * nothing: measured on `next dev`, a run that began before the change read the
 * old state, and stopping the moves for it left one module of four on the old
 * value.
 *
 * 1. Write a record, register it with a delivery that read a declaration the disk
 *    no longer holds, and assert the record's signal moved at once.
 * 2. Assert it moves again after a delay, and again later.
 * 3. Register the same generation again, as every module of it does, and assert
 *    nothing changes; register a new generation that read the old state, and
 *    assert it is signalled at once; then register the current state and assert
 *    the moves stop.
 * 4. Register a stale delivery, then the current state in a new pass, and assert
 *    the bridge owes the signal for the rest of that pass and the next, and not
 *    for the one after; then close the bridge with moves still owed to another
 *    record, and assert it writes nothing more.
 */
export async function test_watch_bridge_moves_the_record_until_the_project_runs_again(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-watch-bridge-confirm-"),
  );
  const tool = path.join(root, ".ttsc");
  const quiet = {
    poll: () => ({ close: () => undefined }),
    watch: () => ({ close: () => undefined }),
  };
  const tsconfig = path.join(root, "tsconfig.json");
  const record = projectRecordFile(tool, tsconfig);
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
  writeProjectRecordFile(record, {
    inputs: {},
    membership: null,
    root,
    signal: 0,
    tsconfig,
  });
  const signal = () => readProjectRecordFile(record)?.signal;

  const bridge = openHostWatchBridge(root, quiet);
  bridge.register(record, stale);
  assert.equal(signal(), 1, "a stale registration moves the record at once");
  assert.ok(bridge.owes(record));
  assert.ok(bridge.owes(), "and the bridge owes a signal");
  await wait(20);
  assert.equal(signal(), 1, "the second move waits");
  await wait(150);
  assert.equal(signal(), 2, "the second move lands");
  await wait(250);
  assert.equal(signal(), 3, "the signal repeats");

  bridge.register(record, stale);
  assert.equal(
    signal(),
    3,
    "a delivery of the same generation registers nothing again",
  );
  assert.ok(bridge.owes(), "and answers nothing");
  bridge.register(record, recorded(true));
  assert.equal(
    signal(),
    4,
    "a new generation that read the old state is signalled again at once",
  );
  bridge.register(record, current);
  assert.equal(bridge.owes(), false, "the current state answers the signal");
  await wait(1_200);
  assert.equal(
    signal(),
    4,
    "a registration that read the current state stops the moves",
  );

  // A host that asks per module whether its cache may serve it is answered
  // for the pass the signal was answered in and the next: the delivery that
  // answered vouches for the state, not for the modules its pass served
  // before it, and the next pass runs them all.
  bridge.register(record, recorded(true));
  assert.ok(bridge.owes(), "a stale delivery owes the signal");
  const pass = bridge.begin();
  bridge.register(record, recorded(false), false, pass);
  assert.ok(
    bridge.owes(),
    "the delivery that answered it still owes the rest of its pass",
  );
  bridge.begin();
  assert.ok(
    bridge.owes(),
    "and the next pass, which runs the modules served before the answer",
  );
  bridge.begin();
  assert.equal(bridge.owes(), false, "the pass after that owes nothing");

  const other = projectRecordFile(tool, path.join(root, "tsconfig.other.json"));
  writeProjectRecordFile(other, {
    inputs: {},
    membership: null,
    root,
    signal: 0,
    tsconfig: path.join(root, "tsconfig.other.json"),
  });
  bridge.register(other, stale);
  const owed = fs.readFileSync(other, "utf8");
  await bridge.close();
  await wait(400);
  assert.equal(
    fs.readFileSync(other, "utf8"),
    owed,
    "a closed bridge writes no owed move",
  );
}
