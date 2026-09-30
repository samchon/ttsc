import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { membershipRecordDigest } from "../../../../packages/unplugin/src/core/bridge/membershipRecordDigest";
import { projectRecordMoved } from "../../../../packages/unplugin/src/core/bridge/projectRecordMoved";
import type { TtscProjectRecord } from "../../../../packages/unplugin/src/core/bridge/TtscProjectRecord";
import { hostInputStateHash } from "../../../../packages/unplugin/src/core/transform/inputs/hostInputStateHash";
import { walkProjectInputs } from "../../../../packages/unplugin/src/core/transform/project/walkProjectInputs";
import { MISSING_INPUT_STATE } from "../../../../packages/unplugin/src/core/transform/validation/MISSING_INPUT_STATE";
import { readProjectMembershipPolicy } from "../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies the persisted record proof independently detects every offline edit kind.
 *
 * Build hosts depend on one project record rather than on each compiler input.
 * Repeating a process restart for every input kind hides that shared boundary;
 * each isolated record proof must detect its edit with no other changed input.
 *
 * 1. Capture a project record containing config, declaration and missing-input proofs.
 * 2. Independently edit configs, content, membership and dependency locations.
 * 3. Assert each edit invalidates and restoring the bytes restores the proof;
 *    excluded outputs and repeated unchanged proofs remain valid.
 */
export function test_project_record_proofs_cover_offline_restart_edits(): void {
  const root = fs.realpathSync.native(TestProject.tmpdir("ttsc-offline-record-"));
  const config = JSON.stringify({ compilerOptions: { outDir: "dist" }, include: ["src"] });
  TestProject.writeFiles(root, {
    "tsconfig.json": config,
    "base.json": '{}\n',
    "src/main.ts": 'export const value = "FIRST";\n',
    "src/types.d.ts": 'declare const value: string;\n',
    "dependency/input.txt": "FIRST",
    "external/shape.d.ts": 'declare const external: string;\n',
  });
  const tsconfig = path.join(root, "tsconfig.json");
  const policy = readProjectMembershipPolicy(tsconfig);
  const walked = walkProjectInputs(root, undefined, policy);
  assert.equal(walked.complete, true);
  const inputs = Object.fromEntries([
    "tsconfig.json", "base.json", "src/main.ts", "src/types.d.ts",
    "dependency/input.txt", "external/shape.d.ts", "dependency/later.txt",
  ].map((relative) => {
    const file = path.join(root, relative);
    const hash = hostInputStateHash(file);
    const missing = hash === undefined;
    return [file, {
      identity: file,
      missing,
      state: { codec: "host" as const, hash: hash ?? MISSING_INPUT_STATE },
      ...(missing ? { unavailable: "missing" as const } : {}),
    }];
  }));
  const record: TtscProjectRecord = {
    inputs,
    membership: {
      digest: membershipRecordDigest(policy, walked.directories),
      directories: walked.directories.map((entry) => entry.path),
      policy,
    },
    root, signal: 0, tsconfig,
  };
  assert.equal(projectRecordMoved(record), undefined);
  assert.equal(projectRecordMoved(record), undefined, "repeated unchanged validation is reusable");
  for (const [relative, changed] of [
    ["tsconfig.json", JSON.stringify({ compilerOptions: { outDir: "dist", strict: true }, include: ["src"] })],
    ["base.json", '{"compilerOptions":{"strict":true}}\n'],
    ["src/main.ts", 'export const value = "SECOND";\n'],
    ["src/types.d.ts", 'declare const value: number;\n'],
    ["dependency/input.txt", "SECOND"],
    ["external/shape.d.ts", 'declare const external: number;\n'],
  ]) {
    const file = path.join(root, relative!);
    const before = fs.readFileSync(file);
    fs.writeFileSync(file, changed!);
    assert.equal(projectRecordMoved(record), file, relative);
    fs.writeFileSync(file, before);
    assert.equal(projectRecordMoved(record), undefined, `${relative} restoration`);
  }
  for (const relative of ["dependency/input.txt", "dependency"]) {
    const original = path.join(root, relative);
    const moved = original + ".moved";
    fs.renameSync(original, moved);
    assert.equal(projectRecordMoved(record), path.join(root, "dependency/input.txt"), relative);
    fs.renameSync(moved, original);
    assert.equal(projectRecordMoved(record), undefined);
  }
  const missing = path.join(root, "dependency/later.txt");
  fs.writeFileSync(missing, "THIRD");
  assert.equal(projectRecordMoved(record), missing, "a newly available dependency invalidates");
  fs.rmSync(missing);
  assert.equal(projectRecordMoved(record), undefined);
  const member = path.join(root, "src/broken.d.ts");
  fs.writeFileSync(member, "export type Broken = ;\n");
  assert.equal(projectRecordMoved(record), root, "a new root file invalidates membership");
  fs.rmSync(member);
  assert.equal(projectRecordMoved(record), undefined);
  TestProject.writeFiles(root, { "dist/ignored.js": "module.exports = 1;\n" });
  assert.equal(projectRecordMoved(record), undefined, "excluded output does not invalidate");
}
