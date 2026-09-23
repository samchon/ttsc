import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { openHostWatchBridge } from "../../../../../packages/unplugin/lib/core/bridge/openHostWatchBridge.js";
import { projectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/projectRecordFile.js";
import { readProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/readProjectRecordFile.js";
import { refreshProjectRecordFiles } from "../../../../../packages/unplugin/lib/core/bridge/refreshProjectRecordFiles.js";
import { signalProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/signalProjectRecordFile.js";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/writeProjectRecordFile.js";

/**
 * Verifies a build start moves a project record it cannot read, with a watching
 * session's bridge or without one, and never brings back a record another
 * process removed.
 *
 * A record is written into the file the host watches, so a signal can read one
 * mid-write, and then writes a bare signal over it. The host runs the project's
 * modules on that move and records the bare bytes, and a delivery of a
 * generation its process already recorded hands the file over without writing
 * it again, so the host's cache can end up holding bytes no proof can run over.
 * Left alone at the next start, those bytes never move, and a module restored
 * from the cache would be served whatever changed while nothing ran.
 *
 * 1. Write a project's record, overwrite it with half of its bytes as a writer
 *    caught mid-write leaves it, and signal it, and assert the signal wrote a
 *    bare signal rather than a record.
 * 2. Refresh without a bridge and then with one, and assert each moves the bytes
 *    again, which still read as no record.
 * 3. Remove the file and signal it, as a start that listed it before another
 *    process removed it does, and assert it stays removed.
 */
export async function test_project_record_that_cannot_be_read_moves_at_a_build_start(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-unreadable-record-"),
  );
  const tsconfig = path.join(root, "tsconfig.json");
  TestProject.writeFiles(root, {
    "src/main.ts": "export {};\n",
    "tsconfig.json": JSON.stringify({ include: ["src"] }),
  });
  const tool = path.join(root, ".ttsc");
  const record = projectRecordFile(tool, tsconfig);
  writeProjectRecordFile(record, {
    inputs: {},
    membership: null,
    root,
    signal: 0,
    tsconfig,
  });
  const whole = fs.readFileSync(record, "utf8");
  fs.writeFileSync(record, whole.slice(0, Math.floor(whole.length / 2)));
  signalProjectRecordFile(record);
  const bare = fs.readFileSync(record, "utf8");
  assert.equal(
    readProjectRecordFile(record),
    undefined,
    "a signal over a record it cannot read writes no record",
  );
  assert.notEqual(bare, whole.slice(0, Math.floor(whole.length / 2)));

  refreshProjectRecordFiles(tool);
  const moved = fs.readFileSync(record, "utf8");
  assert.notEqual(moved, bare, "a build start moves a record it cannot read");
  assert.equal(readProjectRecordFile(record), undefined);
  const quiet = {
    poll: () => ({ close: () => undefined }),
    watch: () => ({ close: () => undefined }),
  };
  const bridge = openHostWatchBridge(root, quiet);
  try {
    refreshProjectRecordFiles(tool, bridge);
    assert.notEqual(
      fs.readFileSync(record, "utf8"),
      moved,
      "and so does a watching session's first pass",
    );
  } finally {
    await bridge.close();
  }

  fs.rmSync(record);
  signalProjectRecordFile(record);
  assert.equal(
    fs.existsSync(record),
    false,
    "a record another process removed stays removed",
  );
}
