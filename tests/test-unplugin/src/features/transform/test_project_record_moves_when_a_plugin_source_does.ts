import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { projectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/projectRecordFile.js";
import { readProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/readProjectRecordFile.js";
import { refreshProjectRecordFiles } from "../../../../../packages/unplugin/lib/core/bridge/refreshProjectRecordFiles.js";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/writeProjectRecordFile.js";
import { pluginSourceState } from "../../../../../packages/unplugin/lib/core/transform/inputs/pluginSourceState.js";

/**
 * Verifies a project's record holds the digest of each plugin source directory
 * it was compiled with, and a build start moves the record exactly when that
 * source moved (samchon/ttsc#1487).
 *
 * A host restoring modules from a persistent cache never runs the adapter, so
 * the record is all its snapshot compares. It held the compiler's inputs and
 * the plugin descriptors around the plugin, never the plugin's own Go source:
 * after a plugin edited in place, a restart restored every module the old
 * binary produced. A plugin source is now one input of the record, whose state
 * is its digest, and a build start proves it like any other.
 *
 * 1. Write the record of a project whose plugin source directory holds Go files,
 *    with the directory's digest.
 * 2. Refresh, and assert nothing moved; write below the source's `node_modules`
 *    and `.git`, and assert nothing moved either.
 * 3. Add a Go file, and edit one, refreshing after each, and assert each moves the
 *    record.
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
  const record = () => ({
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
  assert.ok(writeProjectRecordFile(file, record()), "the first write lands");
  const signal = () => readProjectRecordFile(file)?.signal;

  // 2. The source as compiled, and writes it never keys on.
  refreshProjectRecordFiles(tool);
  assert.equal(signal(), 0, "an unchanged source moves nothing");
  for (const pruned of ["node_modules", ".git"]) {
    fs.mkdirSync(path.join(source, pruned), { recursive: true });
    fs.writeFileSync(path.join(source, pruned, "ignored.go"), "package x\n");
  }
  refreshProjectRecordFiles(tool);
  assert.equal(signal(), 0, "a pruned write is not the source's state");

  // 3. A new file and an edit each move it.
  fs.writeFileSync(path.join(source, "extra.go"), "package main\n");
  refreshProjectRecordFiles(tool);
  assert.equal(signal(), 1, "a new source file moves the record");
  writeProjectRecordFile(file, record());
  refreshProjectRecordFiles(tool);
  assert.equal(signal(), 0, "the delivered state holds again");
  fs.appendFileSync(path.join(source, "main.go"), "// edited\n");
  refreshProjectRecordFiles(tool);
  assert.equal(signal(), 1, "an edited source file moves the record");
}
