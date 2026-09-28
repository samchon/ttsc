import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isolatedCacheEnvironment } from "../../internal/isolated-cache-environment";

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
 */
export const test_dependency_cache_sweeps_a_dead_prior_owner_record =
  (): void => {
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
  };
