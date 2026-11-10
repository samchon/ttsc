import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { TtscProjectRecord } from "../../../../packages/unplugin/src/core/bridge/TtscProjectRecord";
import { projectRecordMoved } from "../../../../packages/unplugin/src/core/bridge/projectRecordMoved";
import { readProjectRecordFile } from "../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import { writeProjectRecordFile } from "../../../../packages/unplugin/src/core/bridge/writeProjectRecordFile";
import { captureCompilerArguments } from "../../../../packages/unplugin/src/core/transform/tsconfig/captureCompilerArguments";
import { resolveCompilerEnvironment } from "../../../../packages/unplugin/src/core/transform/tsconfig/resolveCompilerEnvironment";
import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies a persisted project record stands for its output only while every
 * environment variable the generation's plugins read still has the recorded
 * value in the current process.
 *
 * A host restoring modules from its persistent cache after a restart never runs
 * the adapter for them; the record is what it compares. A restart under another
 * `NODE_ENV`-like value must therefore move the record, while a record whose
 * plugins read nothing, or whose reads still hold, stays put.
 *
 * 1. Write and read back records that recorded a variable as unset, as set to a
 *    value it does not have, and not at all.
 * 2. Assert only the record whose read no longer holds has moved.
 * 3. Assert a record with a malformed environment section is unreadable.
 *
 * @evidence contracts/testing.md#behavioral-verification writeProjectRecordFile, readProjectRecordFile and projectRecordMoved run over real record files and the current process environment; the moved verdict must be the project root exactly for the read that no longer holds.
 * @evidence contracts/testing.md#independent-expectations The variable is one no environment sets, asserted unset first, so the expected verdicts follow from the authored records alone; projectRecordMoved names the project root for an invocation mismatch by contract.
 * @evidence contracts/testing.md#distinguishing-cases Recorded absence that still holds, recorded value that no longer holds, no recorded read, and a malformed section. Input and membership movement belong to test_project_record_moves_exactly_when_the_project_state_does.
 * @evidence contracts/testing.md#execution-ownership Unit test over temporary record files; it reads but never assigns process.env, and no native producer or host runs.
 */
export function test_project_record_moves_when_a_recorded_environment_read_changes(): void {
  const name = "TTSC_TEST_PROJECT_RECORD_ENVIRONMENT_READ";
  assert.equal(process.env[name], undefined, `${name} must be unset`);
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-record-environment-"),
  );
  const tsconfig = path.join(root, "tsconfig.json");
  fs.writeFileSync(tsconfig, "{}\n");
  const base: TtscProjectRecord = {
    compilerArguments: captureCompilerArguments(resolveCompilerEnvironment()),
    inputs: {},
    membership: null,
    root,
    signal: 0,
    tsconfig,
  };
  const roundTrip = (record: TtscProjectRecord): TtscProjectRecord => {
    const file = path.join(root, "record.json");
    writeProjectRecordFile(file, record);
    const read = readProjectRecordFile(file);
    assert.ok(read !== undefined);
    assert.deepEqual(read.environmentInputs, record.environmentInputs);
    return read;
  };

  assert.equal(
    projectRecordMoved(
      roundTrip({ ...base, environmentInputs: { [name]: null } }),
    ),
    undefined,
    "a recorded absence still holds",
  );
  assert.equal(
    projectRecordMoved(
      roundTrip({ ...base, environmentInputs: { [name]: "production" } }),
    ),
    root,
    "a recorded value the process no longer has moves the record",
  );
  assert.equal(
    projectRecordMoved(roundTrip(base)),
    undefined,
    "a record without reads is unaffected",
  );

  const malformed = path.join(root, "malformed.json");
  fs.writeFileSync(
    malformed,
    JSON.stringify({ ...base, environmentInputs: { [name]: 1 } }),
  );
  assert.equal(readProjectRecordFile(malformed), undefined);
}
