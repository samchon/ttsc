import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { inspectPluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/inspectPluginBuildLock";

/**
 * Verifies legacy lock inspection distinguishes absent and live local owners.
 *
 * A synchronously completed owned child supplies the original E2E's native
 * PID input. Signal zero must separately establish ESRCH before that PID is
 * recorded. Numeric PID reuse after preparation remains possible; startedAt
 * describes the record and does not prove process incarnation.
 *
 * 1. Prepare an absent child PID and independently confirm this process lives.
 * 2. Inspect private legacy locks recording each PID on the actual local host.
 * 3. Require abandonment with the dead PID reason and active live ownership.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual exported inspector must classify the exited same-host owner as abandoned with its PID-specific reason and retain the running same-host owner as active.
 * @evidence contracts/testing.md#independent-expectations Child status zero and native ESRCH establish the absent input independently of the inspector; a successful current-PID probe supplies the live contrast. Literal states and the original PID reason pattern are the result oracles.
 * @evidence contracts/testing.md#distinguishing-cases Two otherwise matching local legacy records differ in actual process existence; age, an invalid PID constant or remote ownership cannot substitute for absence. Independent named assertions retain both state and diagnostic failures.
 * @evidence contracts/testing.md#execution-ownership This source-unit imports the authored inspector directly. At most eight inert owned child completions prepare absence, without Go compilation, an installed consumer or a product host. Ambiguous probe errors fail preparation, and PID reuse can exhaust preparation rather than become a skipped or fabricated pass. TestProject owns temporary filesystem cleanup.
 */
export function test_inspectpluginbuildlock_reports_dead_local_owner_as_abandoned(): void {
  const root = TestProject.tmpdir("ttsc-dead-lock-unit-");
  const deadPid = endedProcessId();
  process.kill(process.pid, 0);
  const failures: Error[] = [];
  const check = (name: string, verify: () => void): void => {
    try {
      verify();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  for (const [name, pid] of [
    ["absent", deadPid],
    ["live", process.pid],
  ] as const) {
    check(`${name} local observation`, () => {
      const lockDir = path.join(root, name);
      fs.mkdirSync(lockDir);
      fs.writeFileSync(
        path.join(lockDir, "owner.json"),
        `${JSON.stringify({
          hostname: os.hostname(),
          pid,
          startedAt: new Date().toISOString(),
        })}\n`,
        "utf8",
      );
      const observation = inspectPluginBuildLock(lockDir);
      if (name === "absent") {
        check("absent local state", () =>
          assert.equal(observation.state, "abandoned"),
        );
        check("original absent PID reason", () =>
          assert.match(
            observation.state === "abandoned" ? observation.reason : "",
            new RegExp(`pid ${deadPid} on .+ is no longer running`),
          ),
        );
      } else {
        check("live local state", () =>
          assert.equal(observation.state, "active"),
        );
        check("live PID label", () =>
          assert.match(
            observation.state === "active" ? observation.owner : "",
            new RegExp(`pid ${process.pid} on `),
          ),
        );
      }
    });
  }
  if (failures.length)
    throw new AggregateError(failures, "local lock ownership assertions failed");
}

function endedProcessId(): number {
  for (let attempt = 0; attempt < 8; attempt++) {
    const child = childProcess.spawnSync(process.execPath, ["-e", ""], {
      windowsHide: true,
    });
    assert.equal(child.status, 0, child.stderr?.toString());
    assert.ok(child.pid > 0);
    try {
      process.kill(child.pid, 0);
    } catch (error) {
      assert.equal(
        (error as NodeJS.ErrnoException).code,
        "ESRCH",
        "departed PID preparation must establish absence",
      );
      return child.pid;
    }
  }
  throw new Error(
    "native preparation could not establish an absent owned child PID",
  );
}
