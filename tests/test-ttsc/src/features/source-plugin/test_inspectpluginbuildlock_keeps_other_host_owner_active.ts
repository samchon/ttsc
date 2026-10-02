import { TestProject } from "../../../../utils/src/TestProject";

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
 * 1. Write a lock directory whose `owner.json` names this process's PID on a
 *    hostname that is not this machine's, and require `active`.
 * 2. Independently require a native signal-zero probe to report ESRCH for a
 *    selected PID, then use it under the foreign hostname and require `active`.
 * 3. Name that same absent PID under this machine's own hostname and require
 *    `abandoned`.
 *
 * @evidence contracts/testing.md#behavioral-verification Authored inspectPluginBuildLock returns active and preserves the deliberately foreign hostname in its owner label, regardless of whether that numeric PID happens to identify a local process.
 * @evidence contracts/testing.md#independent-expectations Literal active and abandoned states follow the host-scoped ownership rule. A native process.kill signal-zero probe independently requires ESRCH for the selected PID before inspection, so the product result does not establish its own input premise.
 * @evidence contracts/testing.md#distinguishing-cases Foreign-host records use both this live process and the independently observed absent PID; the same absent PID under the local hostname is the positive abandonment control.
 * @evidence contracts/testing.md#execution-ownership A unit test calling inspectPluginBuildLock directly on three legacy-layout lock directories with owner.json files in a private temp directory; it starts no process, build or host.
 */
export const test_inspectpluginbuildlock_keeps_other_host_owner_active = () => {
  const absentPid = 2_147_483_646;
  assert.throws(
    () => process.kill(absentPid, 0),
    (error: unknown) =>
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === "ESRCH",
    "the selected PID must independently be absent on this host",
  );
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

  // The native probe established absence independently of the lock inspector.
  const deadElsewhere = path.join(root, "dead-elsewhere.lock");
  fs.mkdirSync(deadElsewhere);
  fs.writeFileSync(
    path.join(deadElsewhere, "owner.json"),
    `${JSON.stringify({
      hostname: `${os.hostname()}-elsewhere`,
      pid: absentPid,
      startedAt: new Date().toISOString(),
    })}\n`,
    "utf8",
  );
  assert.equal(inspectPluginBuildLock(deadElsewhere).state, "active");
  const sameHostDead = path.join(root, "dead-local.lock");
  fs.mkdirSync(sameHostDead);
  fs.writeFileSync(
    path.join(sameHostDead, "owner.json"),
    `${JSON.stringify({
      hostname: os.hostname(),
      pid: absentPid,
      startedAt: new Date().toISOString(),
    })}\n`,
    "utf8",
  );
  assert.equal(
    inspectPluginBuildLock(sameHostDead).state,
    "abandoned",
    "local ownership may use the independently observed absence",
  );
};
