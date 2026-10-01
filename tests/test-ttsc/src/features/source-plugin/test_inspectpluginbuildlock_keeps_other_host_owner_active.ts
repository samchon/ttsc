import { TestProject } from "@ttsc/testing";

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspectPluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/inspectPluginBuildLock";

/**
 * Verifies inspectPluginBuildLock keeps an owner from another host active.
 *
 * Negative twin of the dead-owner abandonment along the hostname axis: pid
 * liveness can only be probed on the local machine, so a lock owned by a
 * different host must stay `active` even when that pid identifies a process
 * locally (a shared cache on a network filesystem). Only the wait budget may
 * end that wait.
 *
 * 1. Use this process's PID with a deliberately different hostname.
 * 2. Write a lock directory whose `owner.json` names that pid on a hostname that
 *    is not this machine's.
 * 3. Assert inspection reports `active`, not `abandoned`.
 *
 * @evidence contracts/testing.md#behavioral-verification Authored inspectPluginBuildLock returns active and preserves the deliberately foreign hostname in its owner label, regardless of whether that numeric PID happens to identify a local process.
 * @evidence contracts/testing.md#independent-expectations The authored owner record names this hostname plus -elsewhere; host-scoped ownership forbids any local PID observation from establishing that remote owner dead.
 * @evidence contracts/testing.md#distinguishing-cases The foreign-host owner is the negative control for the same-host dead-owner boundary case. The remote branch does not probe the PID, and both active classification and remote owner label assertions remain.
 * @evidence contracts/testing.md#execution-ownership This named source unit imports the authored lock inspector and reads one private legacy owner record directly. The irrelevant seed child was removed because remote-host policy precedes local liveness probing; real dead-local-owner process coverage remains in its existing boundary case.
 */
export const test_inspectpluginbuildlock_keeps_other_host_owner_active = () => {
  const root = TestProject.tmpdir("ttsc-lock-observe-");
  const lockDir = path.join(root, "entry.lock");
  fs.mkdirSync(lockDir);
  fs.writeFileSync(
    path.join(lockDir, "owner.json"),
    `${JSON.stringify({
      hostname: `${os.hostname()}-elsewhere`,
      pid: process.pid,
      startedAt: new Date().toISOString(),
    })}\n`,
    "utf8",
  );

  const observation = inspectPluginBuildLock(lockDir);

  assert.equal(observation.state, "active");
  const owner = observation.state === "active" ? observation.owner : "";
  assert.match(owner, /-elsewhere/);
};
