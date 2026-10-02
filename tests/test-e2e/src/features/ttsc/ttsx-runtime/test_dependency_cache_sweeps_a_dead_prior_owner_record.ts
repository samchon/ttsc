import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const childProcess = { ...nodeChildProcessForTrace, ...E2eProcessTrace };
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isolatedCacheEnvironment } from "../../../internal/ttsc/internal/isolated-cache-environment";

/**
 * Verifies a manifest-less dependency cache still sweeps prior owner records.
 *
 * Earlier releases used `owner.json` in each `process-<pid>-<nonce>` root. The
 * shared ownership helper now writes `owner-<pid>.json`; forgetting the old
 * form leaves every force-terminated prior root in the system temp directory. A
 * live prior owner must still be kept.
 *
 * 1. Seed old-format roots for a departed process and this live process.
 * 2. Start a fresh manifest-less process to trigger the sweep.
 * 3. Assert only the dead owner's root is removed.
 *
 * @evidence contracts/testing.md#behavioral-verification A fresh process calls dependencyCacheRoot and asserts successful exit, removal of the legacy dead-owner tree and preservation of the live-owner tree.
 * @evidence contracts/testing.md#independent-expectations The fixture records this host and actual departed/current PIDs; literal existence expectations follow ownership safety, not a second invocation of the sweep.
 * @evidence contracts/testing.md#distinguishing-cases Legacy owner.json is tested with one provably exited local owner and one current live owner; modern record and remote-owner decisions belong to the process ownership cases.
 * @evidence contracts/testing.md#execution-ownership The matching named feature entry runs real child processes against the built runtime owner and belongs to the E2E population.
 * @evidence contracts/e2e.md#necessary-boundary A separate manifest-less process must initialize its private cache and observe native PID liveness; the test detects missing legacy sweep assembly, not compiler emission.
 * @evidence contracts/e2e.md#shared-execution One exited seed process establishes a genuine dead PID and one fresh sweep process consumes the same two seeded roots; there is no consumer installation or native compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity An isolated HOME/TMP environment and random directory suffix prevent unrelated legacy roots from participating; finally removes both seeded trees, while the sweep process owns its exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All legacy dead-removal, live-preservation and child-success assertions remain in this named entry; no assertion is transferred or removed.
 */
export function test_dependency_cache_sweeps_a_dead_prior_owner_record(): void {
    const root = TestProject.tmpdir("ttsx-legacy-owner-");
    const env = isolatedCacheEnvironment(root);
    const exited = childProcess.spawnSync(process.execPath, ["-e", ""], {
      windowsHide: true,
    });
    assert.equal(exited.status, 0, exited.stderr?.toString());
    const departedPid = exited.pid;
    assert.ok(departedPid);
    const parent = path.join(env.TMPDIR!, "ttsx-dep");
    const nonce = crypto.randomBytes(8).toString("hex");
    const dead = path.join(parent, `process-${departedPid}-${nonce}`);
    const live = path.join(parent, `process-${process.pid}-${nonce}`);
    for (const [directory, pid] of [
      [dead, departedPid],
      [live, process.pid],
    ] as const) {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, "owner.json"),
        JSON.stringify({ hostname: os.hostname(), pid }),
        "utf8",
      );
    }
    const modulePath = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "lib",
      "launcher",
      "internal",
      "runtime",
      "dependencyCacheRoot.js",
    );
    try {
      const sweep = TestProject.spawn(
        process.execPath,
        [
          "-e",
          `delete process.env.TTSX_RUNTIME_MANIFEST; require(${JSON.stringify(modulePath)}).dependencyCacheRoot({});`,
        ],
        { env },
      );
      assert.equal(sweep.status, 0, sweep.stderr);
      assert.equal(fs.existsSync(dead), false, "the old dead root remained");
      assert.equal(fs.existsSync(live), true, "the old live root was removed");
    } finally {
      fs.rmSync(dead, { force: true, recursive: true });
      fs.rmSync(live, { force: true, recursive: true });
    }
  }
