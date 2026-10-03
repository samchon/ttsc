import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { openHostWatchBridge } from "../../../../../packages/unplugin/src/core/bridge/openHostWatchBridge";
import { projectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/projectRecordFile";
import { readProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import { refreshProjectRecordFiles } from "../../../../../packages/unplugin/src/core/bridge/refreshProjectRecordFiles";
import { signalProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/signalProjectRecordFile";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/writeProjectRecordFile";

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
 * 4. Signal readable records starting at zero and two finite values whose
 *    binary64 successor cannot be obtained by adding one. Each of two requests
 *    must move bytes and preserve readable finite signal/project evidence; no
 *    particular counter encoding or concurrent-writer uniqueness is required.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls record writing, signaling and refresh with and without openHostWatchBridge; asserts truncated records become bare signals, both refresh paths change those bytes while remaining unreadable, and signaling a removed file does not recreate it. Readable signal 0, 9007199254740992 and Number.MAX_VALUE each receive two requests; bytes must move each time while the record stays finite/readable with unchanged project proof.
 * @evidence contracts/testing.md#independent-expectations An unreadable record cannot establish cache validity, so the watched signal must move at the next build start. Distinct raw bytes and undefined decoded records express that requirement without reconstructing the signal algorithm. Every finite signal is accepted by the disk schema, so large finite values cannot silently suppress invalidation; immediate before/after raw-byte inequality is the oracle, not a computed successor.
 * @evidence contracts/testing.md#distinguishing-cases Owns half-written, bare-signal, bridge/no-bridge and removed-record states, plus ordinary zero, the first unsupported unit-increment magnitude and the maximum finite signal. Sequential byte movement does not certify cross-process receipt or atomic uniqueness. Quiet watch/poll seams retain no native handles and the bridge closes in finally; no host cache replay is exercised.
 * @evidence contracts/testing.md#execution-ownership Unit test: calls the real writeProjectRecordFile, signalProjectRecordFile, readProjectRecordFile and refreshProjectRecordFiles (without and then with an openHostWatchBridge built on quiet seams) over a record file in a real temporary directory. No host cache or build is run.
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
  for (const signal of [0, 9007199254740992, Number.MAX_VALUE]) {
    writeProjectRecordFile(record, {
      inputs: {},
      membership: null,
      root,
      signal,
      tsconfig,
    });
    const accepted = readProjectRecordFile(record);
    assert.ok(accepted, "finite native JSON signals are supported records");
    assert.equal(accepted.signal, signal);
    let priorBytes = fs.readFileSync(record, "utf8");
    for (let request = 0; request < 2; request++) {
      signalProjectRecordFile(record);
      const bytes = fs.readFileSync(record, "utf8");
      assert.notEqual(
        bytes,
        priorBytes,
        `signal ${signal}, request ${request}: each request moves observed bytes`,
      );
      const readable = readProjectRecordFile(record);
      assert.ok(readable, "signaling preserves a readable record");
      assert.equal(Number.isFinite(readable.signal), true);
      assert.deepEqual(readable.inputs, {});
      assert.equal(readable.membership, null);
      assert.equal(readable.root, root);
      assert.equal(readable.tsconfig, tsconfig);
      priorBytes = bytes;
    }
  }
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
    assert.equal(readProjectRecordFile(record), undefined);
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
