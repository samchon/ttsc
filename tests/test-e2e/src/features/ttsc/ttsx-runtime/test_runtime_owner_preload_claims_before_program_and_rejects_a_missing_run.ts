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
 * 4. Remove the inherited manifest and assert an independent child can run.
 *
 * @evidence contracts/testing.md#behavioral-verification Node loads runtimeOwnerPreload before user source; assertions require completed owner visibility and user marker, reject a removed run without execution, and allow an empty-manifest independent child.
 * @evidence contracts/testing.md#independent-expectations The user program independently observes its own PID record and writes fixed marker bytes; success and failure are checked through actual process status rather than preload return values.
 * @evidence contracts/testing.md#distinguishing-cases Existing run, removed run with inherited manifest and removed run without inherited manifest separate required admission, fail-closed startup and independent execution.
 * @evidence contracts/testing.md#execution-ownership The named feature entry owns three Node preload sessions; fixture programs are inputs and the assertions execute in this E2E entry.
 * @evidence contracts/e2e.md#necessary-boundary Actual Node preload ordering and inherited environment transport connect the compiled owner preload with user execution, which direct admission calls do not prove.
 * @evidence contracts/e2e.md#shared-execution All three sessions reuse one preload artifact and fixture root without any compiler build; independent lifetimes are necessary because preload startup and environment differ.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The run and marker are explicitly removed before the failure phase, and the independent phase starts without a manifest. Synchronous children finish before the next phase; fixture cleanup owns remaining records.
 * @evidence contracts/e2e.md#preserved-coverage Owner-before-user, missing-run nonzero/no marker and independent marker/status assertions remain in the same entry, with no portable assertion removed.
 */
export function test_runtime_owner_preload_claims_before_program_and_rejects_a_missing_run(): void {
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
  const manifest = path.join(run, "runtime-manifest.json");
  fs.writeFileSync(manifest, "{}", "utf8");
  const program = [
    'const fs = require("node:fs");',
    'const path = require("node:path");',
    "const run = process.env.TTSX_RUNTIME_RUN_DIR;",
    "const owner = path.join(run, `owner-${process.pid}.json`);",
    'if (!fs.existsSync(owner)) throw new Error("owner was not published");',
    `fs.writeFileSync(${JSON.stringify(marker)}, "executed");`,
  ].join("\n");
  const start = (source = program, inheritedManifest = manifest) =>
    TestProject.spawn(process.execPath, ["-r", preload, "-e", source], {
      cwd: root,
      env: {
        NODE_OPTIONS: "",
        TTSX_RUNTIME_MANIFEST: inheritedManifest,
        TTSX_RUNTIME_CACHE_DIR: path.dirname(path.dirname(run)),
        TTSX_RUNTIME_RUN_DIR: run,
        TTSX_RUNTIME_RUNS_DIR: path.dirname(run),
      },
    });

  const claimed = start();
  assert.equal(claimed.status, 0, claimed.stderr);
  assert.equal(fs.readFileSync(marker, "utf8"), "executed");

  fs.rmSync(run, { recursive: true, force: true });
  fs.rmSync(marker);
  const missing = start();
  assert.notEqual(missing.status, 0, missing.stdout);
  assert.equal(fs.existsSync(marker), false, missing.stderr);

  const independent = start(
    `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "independent");`,
    "",
  );
  assert.equal(independent.status, 0, independent.stderr);
  assert.equal(fs.readFileSync(marker, "utf8"), "independent");
}
