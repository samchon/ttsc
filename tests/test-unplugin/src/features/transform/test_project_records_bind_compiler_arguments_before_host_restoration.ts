import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { openHostWatchBridge } from "../../../../../packages/unplugin/src/core/bridge/openHostWatchBridge";
import { projectRecordArgumentsMatch } from "../../../../../packages/unplugin/src/core/bridge/projectRecordArgumentsMatch";
import { projectRecordMoved } from "../../../../../packages/unplugin/src/core/bridge/projectRecordMoved";
import { readProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import { refreshProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/refreshProjectRecordFile";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/writeProjectRecordFile";
import { captureCompilerArguments } from "../../../../../packages/unplugin/src/core/transform/tsconfig/captureCompilerArguments";
import { resolveCompilerEnvironment } from "../../../../../packages/unplugin/src/core/transform/tsconfig/resolveCompilerEnvironment";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies persisted host records require the current compiler invocation.
 *
 * Files can stay unchanged while inherited or explicit permission changes.
 *
 * 1. Prove a captured invocation and contrast another active permission.
 * 2. Refresh detached and watching records before cache restoration.
 * 3. Refuse legacy/malformed witnesses and preserve gone-project removal.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual record decoding, detached proof and bridge admission compare captured arguments; an unchanged filesystem cannot suppress signaling after the active invocation changes.
 * @evidence contracts/testing.md#independent-expectations Literal true/false permissions define different invocations; unchanged, root-moved and incremented-signal expectations do not derive from the record validator.
 * @evidence contracts/testing.md#distinguishing-cases Recorded false versus active true, generic recorded-policy replay, detached versus watching refresh, absent/malformed witnesses and deleted projects cover every restoration boundary without replacing process.env.
 * @evidence contracts/testing.md#execution-ownership This source unit owns one temporary record and actual bridge, closes the bridge in finally and directly calls maintained record operations without a compiler or bundler subprocess.
 */
export async function test_project_records_bind_compiler_arguments_before_host_restoration(): Promise<void> {
  const root = TestProject.createProject({ "tsconfig.json": '{"files":[]}' });
  const tsconfig = path.join(root, "tsconfig.json");
  const file = path.join(root, "record.json");
  const compilerArguments = captureCompilerArguments(
    resolveCompilerEnvironment(false),
    false,
  );
  const changed = captureCompilerArguments(
    resolveCompilerEnvironment(true),
    true,
  ).identity;
  const record = {
    inputs: {},
    membership: null,
    root,
    signal: 0,
    tsconfig,
    compilerArguments,
  };
  assert.equal(projectRecordArgumentsMatch(record), true);
  assert.equal(projectRecordArgumentsMatch(record, changed), false);
  assert.equal(projectRecordMoved(record), undefined);
  assert.equal(projectRecordMoved(record, undefined, changed), root);
  writeProjectRecordFile(file, record);
  refreshProjectRecordFile(
    file,
    undefined,
    undefined,
    compilerArguments.identity,
  );
  assert.equal(readProjectRecordFile(file)?.signal, 0);
  refreshProjectRecordFile(file, undefined, undefined, changed);
  assert.equal(readProjectRecordFile(file)?.signal, 1);
  assert.deepEqual(
    readProjectRecordFile(file)?.compilerArguments,
    compilerArguments,
  );
  const bridge = openHostWatchBridge(root);
  try {
    refreshProjectRecordFile(file, bridge, undefined, changed);
    assert.equal(readProjectRecordFile(file)?.signal, 2);
  } finally {
    await bridge.close();
  }
  const { compilerArguments: _witness, ...legacy } = record;
  assert.equal(projectRecordMoved(legacy), root);
  for (const malformed of [
    null,
    {},
    { identity: "bad" },
    { identity: compilerArguments.identity, runExternalCode: "true" },
  ]) {
    fs.writeFileSync(
      file,
      JSON.stringify({ ...legacy, compilerArguments: malformed }),
    );
    assert.equal(readProjectRecordFile(file), undefined);
  }
  writeProjectRecordFile(file, legacy);
  fs.unlinkSync(tsconfig);
  refreshProjectRecordFile(file);
  assert.equal(fs.existsSync(file), false);
}
