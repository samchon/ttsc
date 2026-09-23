import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { membershipRecordDigest } from "../../../../../packages/unplugin/lib/core/bridge/membershipRecordDigest.js";
import { projectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/projectRecordFile.js";
import { readProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/readProjectRecordFile.js";
import { refreshProjectRecordFiles } from "../../../../../packages/unplugin/lib/core/bridge/refreshProjectRecordFiles.js";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/writeProjectRecordFile.js";
import { hostInputStateHash } from "../../../../../packages/unplugin/lib/core/transform/inputs/hostInputStateHash.js";
import { walkProjectInputs } from "../../../../../packages/unplugin/lib/core/transform/project/walkProjectInputs.js";
import { MISSING_INPUT_STATE } from "../../../../../packages/unplugin/lib/core/transform/validation/MISSING_INPUT_STATE.js";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.js";

/**
 * Verifies a project's record, the one file a build host depends on for every
 * module of the project, is moved by a build start exactly when the project's
 * state on disk differs from what the record holds: an input edited, an absent
 * input appearing, a root file appearing, or the tsconfig vanishing, and never
 * for an unchanged project or a write the walk excludes (samchon/ttsc#1468).
 *
 * A host restoring a module from its persistent cache never runs the adapter
 * for it, so the record is what the host's snapshot compares, and a refresh
 * before the host validates anything is the only place the adapter can learn
 * what changed while nothing ran. The record holds the evidence a generation
 * recorded for each input, and a refresh proves each against the disk the way a
 * delivery proves a generation.
 *
 * A record keeps moving until a delivery writes the state a proof found. The
 * one project that can never deliver again, whose tsconfig is gone, is removed
 * instead, since a start would otherwise move it forever.
 *
 * 1. Write the record of a project from the state of its inputs: a read file, a
 *    file the compile found missing, and the walk's membership under a policy
 *    with an undefined member, which the record must still serialize as JSON a
 *    refresh can read back.
 * 2. Refresh, and assert nothing moved; write below the output directory and
 *    assert nothing moved either.
 * 3. Edit the read file, create the missing one, and add a root file below `src`,
 *    refreshing after each, and assert each moves the record; then assert a
 *    refresh with no delivery since moves it again, since only a delivery
 *    writes the state the refresh found.
 * 4. Remove the tsconfig, refresh twice, and assert the record is removed and
 *    stays removed.
 */
export async function test_project_record_moves_exactly_when_the_project_state_does(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-project-record-"),
  );
  const tsconfig = path.join(root, "tsconfig.json");
  TestProject.writeFiles(root, {
    "src/main.ts": 'import "./types";\nexport {};\n',
    "src/types.d.ts": "declare const before: 1;\n",
    "tsconfig.json": JSON.stringify({
      compilerOptions: { outDir: "dist" },
      include: ["src"],
    }),
  });
  const tool = path.join(root, ".ttsc");
  const read = path.join(root, "src", "types.d.ts");
  const absent = path.join(root, "src", "later.d.ts");
  const adapterPolicy = readProjectMembershipPolicy(tsconfig);
  const policy = {
    ...adapterPolicy,
    directoryExclusionOrigins: {
      exclude: [],
      ...adapterPolicy.directoryExclusionOrigins,
      declarationDir: undefined,
    },
  };
  const file = projectRecordFile(tool, tsconfig);
  assert.equal(path.dirname(path.dirname(file)), tool);
  const walked = walkProjectInputs(root, undefined, policy);
  assert.ok(
    writeProjectRecordFile(file, {
      inputs: {
        [absent]: {
          identity: absent,
          missing: true,
          state: { codec: "host", hash: MISSING_INPUT_STATE },
          unavailable: "missing",
        },
        [read]: {
          identity: read,
          missing: false,
          state: { codec: "host", hash: hostInputStateHash(read)! },
        },
      },
      membership: {
        digest: membershipRecordDigest(policy, walked.directories),
        directories: walked.directories.map((directory) => directory.path),
        policy,
      },
      root,
      signal: 0,
      tsconfig,
    }),
    "the first write lands",
  );
  const signal = () => readProjectRecordFile(file)?.signal;
  const stamp = () => fs.statSync(file, { bigint: true }).mtimeNs;

  const settled = stamp();
  refreshProjectRecordFiles(tool);
  assert.equal(stamp(), settled, "an unchanged project moves nothing");
  assert.equal(signal(), 0);
  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  fs.writeFileSync(path.join(root, "dist", "emitted.js"), "");
  refreshProjectRecordFiles(tool);
  assert.equal(signal(), 0, "an excluded entry is not the project's state");

  fs.writeFileSync(read, "declare const after: 2;\n");
  refreshProjectRecordFiles(tool);
  assert.equal(signal(), 1, "an edited input moves the record");
  refreshProjectRecordFiles(tool);
  assert.equal(signal(), 2, "and keeps moving it until a delivery writes it");

  writeProjectRecordFile(file, {
    ...readProjectRecordFile(file)!,
    inputs: {
      ...readProjectRecordFile(file)!.inputs,
      [read]: {
        identity: read,
        missing: false,
        state: { codec: "host", hash: hostInputStateHash(read)! },
      },
    },
    signal: 0,
  });
  refreshProjectRecordFiles(tool);
  assert.equal(signal(), 0, "the state a delivery wrote holds still");
  fs.writeFileSync(absent, "declare const later: 3;\n");
  refreshProjectRecordFiles(tool);
  assert.equal(signal(), 1, "an absent input appearing moves the record");
  fs.rmSync(absent);
  refreshProjectRecordFiles(tool);
  assert.equal(signal(), 1, "and its removal restores the recorded state");

  fs.writeFileSync(
    path.join(root, "src", "global.d.ts"),
    "declare const g: 1;\n",
  );
  refreshProjectRecordFiles(tool);
  assert.equal(signal(), 2, "a root file appearing moves the record");

  fs.rmSync(tsconfig);
  refreshProjectRecordFiles(tool);
  assert.equal(
    fs.existsSync(file),
    false,
    "a tsconfig that is gone removes the record",
  );
  refreshProjectRecordFiles(tool);
  assert.equal(fs.existsSync(file), false, "and no later start brings it back");
}
