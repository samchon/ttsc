import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { membershipRecordDigest } from "../../../../../packages/unplugin/lib/core/bridge/membershipRecordDigest.js";
import { openHostWatchBridge } from "../../../../../packages/unplugin/lib/core/bridge/openHostWatchBridge.js";
import { projectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/projectRecordFile.js";
import { projectRecordWatchInputs } from "../../../../../packages/unplugin/lib/core/bridge/projectRecordWatchInputs.js";
import { readProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/readProjectRecordFile.js";
import { refreshProjectRecordFiles } from "../../../../../packages/unplugin/lib/core/bridge/refreshProjectRecordFiles.js";
import { writeProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/writeProjectRecordFile.js";
import { createHostPathIdentityContext } from "../../../../../packages/unplugin/lib/core/transform/filesystem/createHostPathIdentityContext.js";
import { pathIdentityKey } from "../../../../../packages/unplugin/lib/core/transform/filesystem/pathIdentityKey.js";
import { hostInputStateHash } from "../../../../../packages/unplugin/lib/core/transform/inputs/hostInputStateHash.js";
import { walkProjectInputs } from "../../../../../packages/unplugin/lib/core/transform/project/walkProjectInputs.js";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.js";

/**
 * Verifies a watching session's bridge takes every project record below the
 * tool directory when a build start hands them over, proving each as a
 * delivery's registration is proven and observing it from then on.
 *
 * A host restoring every module of a project from its persistent cache runs no
 * delivery of that project, so nothing in the process would otherwise observe
 * the project's inputs: an input edited while the host runs, a declaration no
 * bundler loads, would be heard by nothing until the next restart. The record
 * holds the generation's inputs with their evidence, and a bridge handed them
 * observes the project as if the generation had been delivered here.
 *
 * 1. Write the records of two projects: one whose inputs and root files still
 *    hold, and one whose recorded input was edited since, then open a bridge
 *    and hand it the records as a build start does.
 * 2. Assert the stale record is moved at once and owed, and again after a delay,
 *    while the current one stays; register the stale project's current state,
 *    as its delivery does, and assert the moves stop.
 * 3. Add a root file to the current project and hand the records over again, and
 *    assert its record moves, since the bridge proves the record's membership
 *    by walking the project under the recorded policy.
 */
export async function test_watch_bridge_takes_every_record_at_its_first_pass(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-watch-bridge-records-"),
  );
  const tool = path.join(root, ".ttsc");
  const quiet = {
    poll: () => ({ close: () => undefined }),
    watch: () => ({ close: () => undefined }),
  };
  const wait = (milliseconds: number) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));
  // What a delivery records of a host input: its identity and bytes' hash.
  const identities = createHostPathIdentityContext();
  const evidenced = (file: string) => ({
    identity: pathIdentityKey(file, identities),
    missing: false,
    state: { codec: "host" as const, hash: hostInputStateHash(file)! },
  });
  // Two projects side by side, each with a declaration its generation read.
  const project = (name: string) => {
    const directory = path.join(root, name);
    TestProject.writeFiles(directory, {
      "src/main.ts": 'import "./types";\nexport {};\n',
      "src/types.d.ts": `declare const ${name}: 1;\n`,
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
    });
    const tsconfig = path.join(directory, "tsconfig.json");
    const declaration = path.join(directory, "src", "types.d.ts");
    const policy = readProjectMembershipPolicy(tsconfig);
    const walked = walkProjectInputs(directory, undefined, policy);
    const record = projectRecordFile(tool, tsconfig);
    writeProjectRecordFile(record, {
      inputs: {
        [declaration]: evidenced(declaration),
        [tsconfig]: evidenced(tsconfig),
      },
      membership: {
        digest: membershipRecordDigest(policy, walked.directories),
        directories: walked.directories.map((entry) => entry.path),
        policy,
      },
      root: directory,
      signal: 0,
      tsconfig,
    });
    return { declaration, directory, record };
  };
  const current = project("current");
  const stale = project("stale");
  fs.writeFileSync(stale.declaration, "declare const stale: 2;\n");
  const signal = (record: string) => readProjectRecordFile(record)?.signal;

  const bridge = openHostWatchBridge(root, quiet);
  try {
    refreshProjectRecordFiles(tool, bridge);
    assert.equal(
      signal(stale.record),
      1,
      "a record whose input moved is signalled as the bridge takes it",
    );
    assert.ok(bridge.owes(stale.record));
    assert.equal(signal(current.record), 0, "a record that holds stays");
    assert.equal(bridge.owes(current.record), false);
    await wait(150);
    assert.equal(signal(stale.record), 2, "and is moved again until answered");
    // What the stale project's delivery does: write the record of the
    // generation that read the edit, and register it with the bridge.
    const delivered = {
      ...readProjectRecordFile(stale.record)!,
      inputs: {
        ...readProjectRecordFile(stale.record)!.inputs,
        [stale.declaration]: evidenced(stale.declaration),
      },
      signal: 0,
    };
    writeProjectRecordFile(stale.record, delivered);
    bridge.register(stale.record, projectRecordWatchInputs(delivered));
    assert.equal(bridge.owes(), false, "the current state answers it");
    await wait(400);
    assert.equal(signal(stale.record), 0, "and the moves stop");

    fs.writeFileSync(
      path.join(current.directory, "src", "global.d.ts"),
      "declare const g: 1;\n",
    );
    refreshProjectRecordFiles(tool, bridge);
    assert.equal(
      signal(current.record),
      1,
      "a root file appearing moves the record through its membership",
    );
    assert.ok(bridge.owes(current.record));
  } finally {
    await bridge.close();
  }
}
