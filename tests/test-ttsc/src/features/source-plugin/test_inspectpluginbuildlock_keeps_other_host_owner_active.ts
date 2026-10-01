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
 * 2. Do the same with a PID no local process has, still under the foreign
 *    hostname, and require `active`.
 * 3. Name that dead PID under this machine's own hostname and require
 *    `abandoned`, which shows the dead PID really is dead locally.
 *
 * @evidence contracts/testing.md#behavioral-verification Authored inspectPluginBuildLock returns active and preserves the deliberately foreign hostname in its owner label, regardless of whether that numeric PID happens to identify a local process.
 * @evidence contracts/testing.md#independent-expectations The authored owner records name a host that is not this machine, so by the host-scoped ownership rule the owner can never be proven dead locally. The live-pid record can pass even without that rule, so the same hostname is also used with a pid no local process has (2147483646), where the same record under this machine's own hostname must be classified abandoned; the foreign-host copy of it must stay active.
 * @evidence contracts/testing.md#distinguishing-cases The foreign-host owner with a live pid and with a dead pid is the negative; the same dead pid under the local hostname is the positive control that is classified abandoned, which shows the dead-pid fixture really is dead on this host.
 * @evidence contracts/testing.md#execution-ownership A unit test calling inspectPluginBuildLock directly on three legacy-layout lock directories with owner.json files in a private temp directory; it starts no process, build or host.
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

  // A pid no local process can have: on this host the owner would be abandoned,
  // so staying active can only come from the foreign hostname.
  const deadElsewhere = path.join(root, "dead-elsewhere.lock");
  fs.mkdirSync(deadElsewhere);
  fs.writeFileSync(
    path.join(deadElsewhere, "owner.json"),
    `${JSON.stringify({
      hostname: `${os.hostname()}-elsewhere`,
      pid: 2_147_483_646,
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
      pid: 2_147_483_646,
      startedAt: new Date().toISOString(),
    })}\n`,
    "utf8",
  );
  assert.equal(
    inspectPluginBuildLock(sameHostDead).state,
    "abandoned",
    "the pid must be dead locally for the foreign-host case to prove anything",
  );
};
