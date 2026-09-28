import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a runtime child claims its own run before user code executes.
 *
 * A launcher can die immediately after spawning a child. If only the launcher
 * records the child's PID, a failed or interrupted write lets default clean
 * remove the output under a live program. The inherited preload serializes its
 * claim with clean and refuses to start when the run was already removed.
 *
 * 1. Start Node with the owner preload and an existing run directory.
 * 2. Assert user code sees its own completed owner record.
 * 3. Start it against a removed run and assert user code never executes.
 */
export const test_runtime_owner_preload_claims_before_program_and_rejects_a_missing_run =
  (): void => {
    const root = TestProject.tmpdir("ttsx-owner-preload-");
    const run = path.join(root, "ttsx", "project", "claim");
    fs.mkdirSync(run, { recursive: true });
    const preload = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "lib",
      "launcher",
      "internal",
      "runtimeOwnerPreload.js",
    );
    const marker = path.join(root, "executed");
    const program = [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      'const run = process.env.TTSX_RUNTIME_RUN_DIR;',
      'const owner = path.join(run, `owner-${process.pid}.json`);',
      'if (!fs.existsSync(owner)) throw new Error("owner was not published");',
      `fs.writeFileSync(${JSON.stringify(marker)}, "executed");`,
    ].join("\n");
    const start = () =>
      TestProject.spawn(process.execPath, ["-r", preload, "-e", program], {
        cwd: root,
        env: { NODE_OPTIONS: "", TTSX_RUNTIME_RUN_DIR: run },
      });

    const claimed = start();
    assert.equal(claimed.status, 0, claimed.stderr);
    assert.equal(fs.readFileSync(marker, "utf8"), "executed");

    fs.rmSync(run, { recursive: true, force: true });
    fs.rmSync(marker);
    const missing = start();
    assert.notEqual(missing.status, 0, missing.stdout);
    assert.equal(fs.existsSync(marker), false, missing.stderr);
  };
