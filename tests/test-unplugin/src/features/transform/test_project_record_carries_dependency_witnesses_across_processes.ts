import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { TtscProjectRecord } from "../../../../../packages/unplugin/src/core/bridge/TtscProjectRecord";
import { projectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/projectRecordFile";
import { readProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/writeProjectRecordFile";
import { recordedDependencyWitnesses } from "../../../../../packages/unplugin/src/core/transform/watch/recordedDependencyWitnesses";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a project record carries its generation's dependency-only paths and
 * a new transform cache reads them as witness hints, from the tool directory or
 * its fallback (samchon/ttsc#1743).
 *
 * 1. Write a record naming two dependencies and read it back: the paths survive,
 *    and a record without them reads as before.
 * 2. A record whose dependencies are not a string list reads as no record.
 * 3. Select the hints through the host's directories: the tool directory's record
 *    answers, the fallback answers when the tool directory has none, and no
 *    record or no project answers nothing.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual writer, reader and hint selector run over real record files.
 * @evidence contracts/testing.md#independent-expectations The authored dependency lists fix every expected hint.
 * @evidence contracts/testing.md#distinguishing-cases Records with, without and with malformed dependencies, and the tool, fallback and absent directories are separate rows.
 * @evidence contracts/testing.md#execution-ownership This source unit owns its temporary directories; no compiler or watcher starts.
 */
export function test_project_record_carries_dependency_witnesses_across_processes(): void {
  const root = TestProject.tmpdir("ttsc-record-witnesses-");
  const tsconfig = path.join(root, "project", "tsconfig.json");
  const tool = path.join(root, "tool");
  const fallback = path.join(root, "fallback");
  const record = (dependencies?: readonly string[]): TtscProjectRecord => ({
    ...(dependencies === undefined ? {} : { dependencies }),
    inputs: {},
    membership: null,
    root: path.dirname(tsconfig),
    signal: 0,
    tsconfig,
  });
  const dependencies = [
    path.join(root, "external", "a.d.ts"),
    path.join(root, "rules.txt"),
  ];

  const toolRecord = projectRecordFile(tool, tsconfig);
  writeProjectRecordFile(toolRecord, record(dependencies));
  assert.deepEqual(
    readProjectRecordFile(toolRecord)?.dependencies,
    dependencies,
  );
  const plain = projectRecordFile(path.join(root, "plain"), tsconfig);
  writeProjectRecordFile(plain, record());
  assert.equal(readProjectRecordFile(plain)?.dependencies, undefined);
  assert.equal(readProjectRecordFile(plain)?.tsconfig, tsconfig);

  const malformed = projectRecordFile(path.join(root, "malformed"), tsconfig);
  fs.mkdirSync(path.dirname(malformed), { recursive: true });
  fs.writeFileSync(
    malformed,
    JSON.stringify({ ...record(), dependencies: [1] }),
    "utf8",
  );
  assert.equal(readProjectRecordFile(malformed), undefined);

  const register = () => undefined;
  assert.deepEqual(
    recordedDependencyWitnesses({ register, toolDirectory: tool }, tsconfig),
    dependencies,
  );
  const fallbackDependencies = [path.join(root, "fallback.txt")];
  writeProjectRecordFile(
    projectRecordFile(fallback, tsconfig),
    record(fallbackDependencies),
  );
  assert.deepEqual(
    recordedDependencyWitnesses(
      {
        fallbackToolDirectory: fallback,
        register,
        toolDirectory: path.join(root, "unwritten"),
      },
      tsconfig,
    ),
    fallbackDependencies,
  );
  assert.equal(
    recordedDependencyWitnesses(
      { register, toolDirectory: path.join(root, "unwritten") },
      tsconfig,
    ),
    undefined,
  );
  assert.equal(recordedDependencyWitnesses(undefined, tsconfig), undefined);
}
