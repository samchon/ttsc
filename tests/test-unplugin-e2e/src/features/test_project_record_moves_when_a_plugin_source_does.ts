import { TestProject } from "../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { projectRecordFile } from "../../../../packages/unplugin/src/core/bridge/projectRecordFile";
import { readProjectRecordFile } from "../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import { refreshProjectRecordFiles } from "../../../../packages/unplugin/src/core/bridge/refreshProjectRecordFiles";
import { writeProjectRecordFile } from "../../../../packages/unplugin/src/core/bridge/writeProjectRecordFile";
import { pluginSourceState } from "../../../../packages/unplugin/src/core/transform/inputs/pluginSourceState";

/**
 * Verifies a project's record holds the state of each plugin source directory
 * it was compiled with, and a build start moves the record exactly when that
 * state moved: the source's files, or the environment its binary is built in
 * (samchon/ttsc#1487, samchon/ttsc#1493).
 *
 * A host restoring modules from a persistent cache never runs the adapter, so
 * the record is all its snapshot compares. It held the compiler's inputs and
 * the plugin descriptors around the plugin, never the plugin's own Go source:
 * after a plugin edited in place, a restart restored every module the old
 * binary produced, and one under another `GOFLAGS` still does if the state
 * covers the files alone. A plugin source is now one input of the record, whose
 * state is ttsc's, and a build start proves it like any other.
 *
 * 1. Write the record of a project whose plugin source directory holds Go files,
 *    with the directory's state.
 * 2. Start a build, and assert nothing moved; write below the source's
 *    `node_modules` and `.git`, and assert nothing moved either.
 * 3. Add a Go file, and edit one, starting a build after each, and assert each
 *    moves the record.
 * 4. Deliver the state again, set another `GOFLAGS`, start a build, and assert it
 *    moves the record.
 *
 * @evidence contracts/testing.md#behavioral-verification refreshProjectRecordFiles detects plugin Go source additions/edits and GOFLAGS change while ignoring unchanged and pruned source directories.
 * @evidence contracts/testing.md#independent-expectations Authored zero/one signals follow source and build-environment identity: restoring a delivered current state is quiet and a deliberate source/environment change invalidates.
 * @evidence contracts/testing.md#distinguishing-cases node_modules/.git writes remain quiet; added and edited Go files invalidate separately, then a changed GOFLAGS invalidates the refreshed baseline.
 * @evidence contracts/testing.md#execution-ownership This entry calls pluginSourceState and record refresh against temporary source bytes, preserving/restoring GOFLAGS; pluginSourceState/holds may probe go env/go version and GOROOT identity, but no plugin binary is built.
 *
 * @evidence contracts/e2e.md#necessary-boundary The project record must invalidate when an actual Go environment change moves its plugin source proof. Direct digest composition cannot establish this Go provider connection; the original actual source/environment assertions remain here.
 * @evidence contracts/e2e.md#shared-execution All authored edits share the private module and one Node process with the installed Go toolchain; unchanged environment observations reuse the provider reading, and no plugin binary or consumer installation is prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns private fixture roots; original environment restoration and observer disposal remain unchanged. Each deliberately changed source or environment receives its original fresh proof.
 * @evidence contracts/e2e.md#preserved-coverage The transferred case retains every original input, literal assertion, negative control and cleanup statement. Only physical execution ownership changes from features/unit to features/e2e.
 */
export async function test_project_record_moves_when_a_plugin_source_does(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-plugin-source-record-"),
  );
  const tsconfig = path.join(root, "tsconfig.json");
  TestProject.writeFiles(root, {
    "plugin/go.mod": "module example.com/plugin\n\ngo 1.26\n",
    "plugin/main.go": "package main\n\nfunc main() {}\n",
    "src/main.ts": "export {};\n",
    "tsconfig.json": JSON.stringify({ include: ["src"] }),
  });
  const source = path.join(root, "plugin");
  const tool = path.join(root, ".ttsc");
  const file = projectRecordFile(tool, tsconfig);
  // What a delivery writes, and what a build start runs.
  const deliver = () => {
    writeProjectRecordFile(file, {
      inputs: {
        [source]: {
          identity: source,
          missing: false,
          state: { codec: "tree" as const, digest: pluginSourceState(source)! },
        },
      },
      membership: null,
      root,
      signal: 0,
      tsconfig,
    });
  };
  const buildStart = () => refreshProjectRecordFiles(tool);
  const signal = () => readProjectRecordFile(file)?.signal;

  // 1. The record.
  deliver();
  assert.equal(signal(), 0, "the first write lands");

  // 2. The source as compiled, and writes it never keys on.
  buildStart();
  assert.equal(signal(), 0, "an unchanged source moves nothing");
  for (const pruned of ["node_modules", ".git"]) {
    fs.mkdirSync(path.join(source, pruned), { recursive: true });
    fs.writeFileSync(path.join(source, pruned, "ignored.go"), "package x\n");
  }
  buildStart();
  assert.equal(signal(), 0, "a pruned write is not the source's state");

  // 3. A new file and an edit each move it.
  fs.writeFileSync(path.join(source, "extra.go"), "package main\n");
  buildStart();
  assert.equal(signal(), 1, "a new source file moves the record");
  deliver();
  buildStart();
  assert.equal(signal(), 0, "the delivered state holds again");
  fs.appendFileSync(path.join(source, "main.go"), "// edited\n");
  buildStart();
  assert.equal(signal(), 1, "an edited source file moves the record");

  // 4. Another build environment moves it too.
  deliver();
  const previous = process.env.GOFLAGS;
  process.env.GOFLAGS = "-tags=ttsc_record_environment_probe";
  try {
    buildStart();
    assert.equal(signal(), 1, "another GOFLAGS moves the record");
  } finally {
    if (previous === undefined) delete process.env.GOFLAGS;
    else process.env.GOFLAGS = previous;
  }
}
