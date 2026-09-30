import { TestProject } from "@ttsc/testing";

import {
  assert,
  child_process,
  fs,
  inspectPluginBuildLock,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies inspectPluginBuildLock keeps an owner from another host active.
 *
 * Negative twin of the dead-owner abandonment along the hostname axis: pid
 * liveness can only be probed on the local machine, so a lock owned by a
 * different host must stay `active` even when that pid happens to be dead
 * locally (a shared cache on a network filesystem). Only the wait budget may
 * end that wait.
 *
 * 1. Take a locally dead pid from a completed child process.
 * 2. Write a lock directory whose `owner.json` names that pid on a hostname that
 *    is not this machine's.
 * 3. Assert inspection reports `active`, not `abandoned`.
 *
 * @evidence contracts/testing.md#behavioral-verification Shipped inspectPluginBuildLock must return active and preserve the remote hostname in its owner label even when its numeric PID belongs to a locally exited process.
 * @evidence contracts/testing.md#independent-expectations The owner record explicitly names this hostname plus -elsewhere; the host-scoped ownership contract independently forbids a local dead PID from proving that remote owner gone.
 * @evidence contracts/testing.md#distinguishing-cases The remote-host axis is the negative control for the same-host dead-owner case, with status and label assertions. Actual remote liveness is neither observed nor claimed.
 * @evidence contracts/testing.md#execution-ownership This exported entry currently creates a completed child and invokes the built inspector over a fixture legacy owner record; the remote-host branch does not use that child PID for a liveness syscall.
 * @evidence contracts/e2e.md#necessary-boundary No unique required native process connection is established by this remote-host policy case: the product rejects local liveness authority before probing the PID. A direct owning-source filesystem unit can preserve the hostname/state/label assertions without this child, and remains a transfer candidate.
 * @evidence contracts/e2e.md#shared-execution One owner record and one inspection are sufficient; the completed child currently supplies an irrelevant locally dead PID and is not reusable producer preparation that this remote-host decision requires.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The legacy lock lives under a private root and the seed child exits synchronously. Inspection captures its fence but does not acquire a builder lease; the test neither modifies a shared host nor queries a remote process.
 * @evidence contracts/e2e.md#preserved-coverage Seed status, active classification and remote owner label remain unchanged. This acknowledgment records the source-unit candidate rather than claiming the extra child establishes a necessary E2E boundary.
 */
export const test_inspectpluginbuildlock_keeps_other_host_owner_active = () => {
  const root = TestProject.tmpdir("ttsc-lock-observe-");
  const lockDir = path.join(root, "entry.lock");
  fs.mkdirSync(lockDir);
  const exited = child_process.spawnSync(process.execPath, ["-e", ""], {
    windowsHide: true,
  });
  assert.equal(exited.status, 0);
  fs.writeFileSync(
    path.join(lockDir, "owner.json"),
    `${JSON.stringify({
      hostname: `${os.hostname()}-elsewhere`,
      pid: exited.pid,
      startedAt: new Date().toISOString(),
    })}\n`,
    "utf8",
  );

  const observation = inspectPluginBuildLock(lockDir);

  assert.equal(observation.state, "active");
  const owner = observation.state === "active" ? observation.owner : "";
  assert.match(owner, /-elsewhere/);
};
