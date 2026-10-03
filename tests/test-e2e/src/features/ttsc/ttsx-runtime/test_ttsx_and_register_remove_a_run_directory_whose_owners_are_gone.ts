import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const child_process = { ...nodeChildProcessForTrace, ...E2eProcessTrace };
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { isolatedCacheEnvironment } from "../../../internal/ttsc/internal/isolated-cache-environment";
import { runtimeRunsDirectory } from "../../../internal/ttsc/internal/ttsx-run";

/**
 * Verifies both ttsx and `ttsc/register` remove, while preparing, a runtime
 * directory whose recorded owners are all gone.
 *
 * A run terminated outright never removes its runtime directory. Each run now
 * records its processes as the owners of its directory, and a later preparation
 * removes the directories whose owners are all provably gone
 * (samchon/ttsc#1579). Both entry points prepare through the same step, and
 * each is held to it here.
 *
 * 1. Plant a run directory whose only owner record names a process of this host
 *    that has ended.
 * 2. Run an entry through ttsx, and assert the planted directory is gone.
 * 3. Plant another, run the entry through `node --import ttsc/register`, and
 *    assert that directory is gone too.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsx and node --import register each execute the typed entry and must remove a separately planted stale run whose actual local owner has exited.
 * @evidence contracts/testing.md#independent-expectations Each seed PID is verified absent by the native process probe; fixed ran output and stale-tree absence follow public execution and cleanup contracts independently of owner decoding.
 * @evidence contracts/testing.md#distinguishing-cases Both launcher and register assembly paths consume newly seeded stale trees; keeping a live or uncertain owner belongs to complementary ownership and cleanup cases.
 * @evidence contracts/testing.md#execution-ownership The named E2E entry owns both actual product host sessions and their per-session stale seeds; helper child source only establishes genuine departed-process evidence.
 * @evidence contracts/e2e.md#necessary-boundary The two public entry adapters must both reach preparation sweeping; testing ProcessOwnedDirectory directly cannot detect a missing adapter call.
 * @evidence contracts/e2e.md#shared-execution The entry project, built register artifact and cache are shared, while each adapter requires its own process lifetime and newly seeded stale tree. Both preparations currently compile the same project separately.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture declares its own workspace boundary so an ancestor installation cannot select an external cache. Each phase plants a distinct stale generation immediately before its consumer; isolated HOME/TMP/cache environment prevents external cleanup, and synchronous sessions exit before the next seed.
 * @evidence contracts/e2e.md#preserved-coverage Both zero statuses, ran outputs and their individual stale-removal assertions remain; no equivalence claim hides the repeated adapter preparations.
 */
export function test_ttsx_and_register_remove_a_run_directory_whose_owners_are_gone(): void {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_and_register_remove_a_run_directory_whose_owners_are_gone/inputs-1"));
    const runs = runtimeRunsDirectory(root);
    const env = isolatedCacheEnvironment(root);
    const plant = (name: string): string => {
      const directory = path.join(runs, name);
      const pid = endedProcessId();
      fs.mkdirSync(path.join(directory, "fs"), { recursive: true });
      fs.writeFileSync(
        path.join(directory, `owner-${pid}.json`),
        JSON.stringify({ hostname: os.hostname(), pid }),
        "utf8",
      );
      fs.writeFileSync(path.join(directory, "fs", "main.js"), "", "utf8");
      return directory;
    };

    const byTtsx = plant("ended-ttsx-run");
    const ttsx = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root, env },
    );
    assert.equal(ttsx.status, 0, ttsx.stderr);
    assert.equal(ttsx.stdout.trim(), "ran");
    assert.equal(
      fs.existsSync(byTtsx),
      false,
      "ttsx kept a run directory whose owners are gone",
    );

    const byRegister = plant("ended-register-run");
    const register = TestProject.spawn(
      process.execPath,
      [
        "--import",
        pathToFileURL(
          path.join(
            TestProject.WORKSPACE_ROOT,
            "packages",
            "ttsc",
            "lib",
            "register.js",
          ),
        ).href,
        "src/main.ts",
      ],
      { cwd: root, env },
    );
    assert.equal(register.status, 0, register.stderr);
    assert.equal(register.stdout.trim(), "ran");
    assert.equal(
      fs.existsSync(byRegister),
      false,
      "ttsc/register kept a run directory whose owners are gone",
    );
  }

/** The id of a process of this host that ran and has ended. */
function endedProcessId(): number {
  for (;;) {
    const { error, pid } = child_process.spawnSync(process.execPath, [
      "-e",
      "",
    ]);
    if (error !== undefined || pid === undefined)
      throw error ?? new Error("the process started without an id");
    try {
      process.kill(pid, 0);
    } catch {
      return pid;
    }
  }
}
