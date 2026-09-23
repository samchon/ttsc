import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { openHostWatchBridge } from "../../../../../packages/unplugin/lib/core/bridge/openHostWatchBridge.js";
import { projectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/projectRecordFile.js";
import { readProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/readProjectRecordFile.js";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/writeProjectRecordFile.js";

/**
 * Verifies a bridge moves a record on its growing schedule only while the
 * host's last compile depended on it, keeps observing and moving once per
 * change a record it did not, and resumes the schedule for a signal still owed
 * when a compile comes to depend on the record.
 *
 * The moves after a signal's first defend the host's watcher, which observes
 * only what the last compile depended on. Next runs a client, a server and an
 * edge compiler, each with a bridge that takes every record at its first pass,
 * and the edge compiler holds no module of the page's project: its bridge would
 * otherwise move the record for the rest of the session, each move running the
 * client and server compilers again. Nor may the record leave the observer:
 * `next dev` compiles a page on its first request, so no compiler depends on
 * the record at its first compile, and a tsconfig edited after the page was
 * served from the cache would be heard by nothing.
 *
 * 1. Register two records with deliveries that read the current state, and report
 *    a compile that depends on the first only.
 * 2. Create the declaration both deliveries found missing, and assert the first
 *    record moves on its schedule while the second moves exactly once and stays
 *    owed.
 * 3. Report a compile that depends on both, and assert the second record moves at
 *    once and keeps moving on its schedule.
 */
export async function test_watch_bridge_repeats_moves_only_for_a_record_its_host_watches(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-watch-bridge-watched-"),
  );
  const tool = path.join(root, ".ttsc");
  const listeners: ((eventType: string, file: string | null) => void)[] = [];
  const operations = {
    poll: () => ({ close: () => undefined }),
    watch: (
      _root: string,
      listener: (eventType: string, file: string | null) => void,
    ) => {
      listeners.push(listener);
      return { close: () => undefined };
    },
  };
  const declaration = path.join(root, "src", "types.d.ts");
  // A delivery that found the declaration missing, which the disk agrees with.
  const current = () => [
    {
      evidence: {
        identity: declaration,
        missing: true,
        state: {
          codec: "predicates" as const,
          observation: { fileExists: false },
        },
      },
      file: declaration,
    },
  ];
  const records = ["client", "edge"].map((name) => {
    const tsconfig = path.join(root, name, "tsconfig.json");
    const file = projectRecordFile(tool, tsconfig);
    writeProjectRecordFile(file, {
      inputs: {},
      membership: null,
      root: path.join(root, name),
      signal: 0,
      tsconfig,
    });
    return file;
  });
  const [watched, unwatched] = records as [string, string];
  const signal = (file: string) => readProjectRecordFile(file)?.signal ?? 0;
  const wait = (milliseconds: number) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

  const bridge = openHostWatchBridge(root, operations);
  try {
    bridge.register(watched, current());
    bridge.register(unwatched, current());
    bridge.compiled((record) => record === watched);
    assert.equal(signal(watched), 0, "a current registration moves nothing");
    assert.equal(signal(unwatched), 0);

    fs.mkdirSync(path.dirname(declaration), { recursive: true });
    fs.writeFileSync(declaration, "declare const value: 1;\n");
    for (const listener of listeners) listener("rename", declaration);
    await wait(400);
    assert.ok(
      signal(watched) >= 3,
      `the record the host watches moves on its schedule: ${signal(watched)}`,
    );
    assert.equal(
      signal(unwatched),
      1,
      "the record it does not watch is still observed, and moved once",
    );
    assert.ok(bridge.owes(unwatched), "and its signal stays owed");

    bridge.compiled(() => true);
    assert.equal(
      signal(unwatched),
      2,
      "a compile that comes to depend on it moves it again at once",
    );
    await wait(150);
    assert.ok(
      signal(unwatched) >= 3,
      `and on the schedule from then on: ${signal(unwatched)}`,
    );
  } finally {
    await bridge.close();
  }
}
