import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { membershipDigestFile } from "../../../../../packages/unplugin/lib/core/bridge/membershipDigestFile.mjs";
import { membershipRecordDigest } from "../../../../../packages/unplugin/lib/core/bridge/membershipRecordDigest.mjs";
import { refreshMembershipDigestFiles } from "../../../../../packages/unplugin/lib/core/bridge/refreshMembershipDigestFiles.mjs";
import { writeMembershipDigestFile } from "../../../../../packages/unplugin/lib/core/bridge/writeMembershipDigestFile.mjs";
import { walkProjectInputs } from "../../../../../packages/unplugin/lib/core/transform/project/walkProjectInputs.mjs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.mjs";

/**
 * Verifies a project's membership record, the file a host's persistent cache
 * records for its root-file membership, moves exactly when the membership does:
 * a refresh before a build rewrites it for a root file that appeared or
 * vanished while nothing ran, and for a tsconfig that is gone, and leaves it
 * alone otherwise (samchon/ttsc#1468).
 *
 * A host restoring a module from its cache never runs the adapter for it, so
 * the record is the one input through which a root file appearing between two
 * builds, or across a restart, reaches the host: the adapter refreshes every
 * record below its tool directory before the host validates anything, and the
 * host's own snapshot then decides. A rewrite of an unchanged digest would
 * invalidate every module on every start, so the file's bytes must hold still
 * while the membership does.
 *
 * 1. Write the record from a walk under a policy with an undefined member,
 *    refresh, and assert the file's bytes and stamp are untouched.
 * 2. Add a root file below `src` and an entry the tsconfig excludes, refresh, and
 *    assert the digest moved once, for the root file alone.
 * 3. Remove the tsconfig, refresh, and assert the record says so.
 */
export async function test_membership_record_moves_exactly_when_the_root_files_do(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-membership-record-"),
  );
  const tsconfig = path.join(root, "tsconfig.json");
  TestProject.writeFiles(root, {
    "src/main.ts": "export {};\n",
    "tsconfig.json": JSON.stringify({
      compilerOptions: { outDir: "dist" },
      include: ["src"],
    }),
  });
  const tool = path.join(root, ".ttsc");
  // A policy the adapter reads carries members it left undefined, which a
  // record must still serialize as JSON a refresh can read back.
  const adapterPolicy = readProjectMembershipPolicy(tsconfig);
  const policy = {
    ...adapterPolicy,
    directoryExclusionOrigins: {
      exclude: [],
      ...adapterPolicy.directoryExclusionOrigins,
      declarationDir: undefined,
    },
  };
  const digest = () =>
    membershipRecordDigest(
      policy,
      walkProjectInputs(root, undefined, policy).directories,
    );
  const file = membershipDigestFile(tool, tsconfig);
  assert.equal(path.dirname(path.dirname(file)), tool);
  assert.ok(
    writeMembershipDigestFile(file, {
      digest: digest(),
      policy,
      root,
      tsconfig,
    }),
    "the first write lands",
  );
  const read = () =>
    JSON.parse(fs.readFileSync(file, "utf8")) as { digest: string | null };
  const stamp = () => fs.statSync(file, { bigint: true }).mtimeNs;

  const settled = stamp();
  const recorded = read().digest;
  refreshMembershipDigestFiles(tool);
  assert.equal(stamp(), settled, "an unchanged membership rewrites nothing");
  assert.equal(read().digest, recorded);

  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  fs.writeFileSync(path.join(root, "dist", "emitted.js"), "");
  refreshMembershipDigestFiles(tool);
  assert.equal(read().digest, recorded, "an excluded entry is not membership");

  fs.writeFileSync(
    path.join(root, "src", "global.d.ts"),
    "declare const g: 1;\n",
  );
  refreshMembershipDigestFiles(tool);
  const moved = read().digest;
  assert.notEqual(moved, recorded, "a root file appearing moves the digest");
  assert.equal(moved, digest());
  const after = stamp();
  refreshMembershipDigestFiles(tool);
  assert.equal(stamp(), after, "the moved digest holds still");

  fs.rmSync(tsconfig);
  refreshMembershipDigestFiles(tool);
  assert.equal(read().digest, null, "a tsconfig that is gone is recorded");
}
