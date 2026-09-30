import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../../../../packages/ttsc/lib/index.js";
import { isolatedCacheEnvironment } from "../../internal/isolated-cache-environment";
import {
  WAITING_PROGRAM,
  forceTerminate,
  runDirectory,
  runtimeRunsDirectory,
  startWaitingRun,
  stopWaitingRun,
  type IWaitingRun,
} from "../../internal/ttsx-run";

/**
 * Verifies `ttsc clean` removes the ttsx runtime directories no run owns, and
 * keeps and reports the one of a run in progress.
 *
 * `ttsc clean` never looked at the runtime directory below the cache root, so
 * the directory a force-terminated run left there outlived every clean
 * (samchon/ttsc#1579). It now removes each run directory whose owners are all
 * gone, while a run still in progress keeps its own; with none in progress, the
 * runtime directory goes whole, through `TtscCompiler.clean()` as well.
 *
 * 1. Start a waiting run and keep it. Start a second, and force-terminate both of
 *    its processes.
 * 2. Run `ttsc clean`, and assert the terminated directory is removed, and the
 *    running one is kept and reported.
 * 3. Force-terminate the kept run, call `TtscCompiler.clean()`, and assert it
 *    removed the runtime directory whole.
 *
 * @evidence contracts/testing.md#behavioral-verification Public clean must remove the killed run, preserve the running run and print its exact kept line; after all owners die, TtscCompiler.clean must report and remove the whole runtime.
 * @evidence contracts/testing.md#independent-expectations Genuine waiting child PIDs and forced termination establish ownership states; literal kept text and filesystem absence/presence provide independent observations. Native realpath alternatives permit spelling, not a different target.
 * @evidence contracts/testing.md#distinguishing-cases Simultaneous live and dead generations distinguish selective cleanup; the later all-dead state distinguishes whole-runtime API cleanup from only child removal.
 * @evidence contracts/testing.md#execution-ownership The named async E2E entry owns two waiting launcher/program pairs, one public clean command and the public compiler API cleanup call.
 * @evidence contracts/e2e.md#necessary-boundary Real launcher and program ownership must survive public CLI cleanup and then release for public API cleanup; direct record predicates do not establish this lifecycle connection.
 * @evidence contracts/e2e.md#shared-execution Both waiting runs use one project and cache, but prepare independently as two simultaneous run identities. The CLI and API consumers reuse those states; repeated native preparation remains in the current harness.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture declares its own workspace boundary so an ancestor installation cannot select an external cache. An isolated environment contains cleanup paths; both acquired launcher/program pairs are retained by the test and finally releases both authenticated fixture programs through private nonce channels and awaits stdio closure through allSettled even if one cleanup fails. Startup failures are cleaned by the authenticated waiting helper.
 * @evidence contracts/e2e.md#preserved-coverage All terminated-removal, live-preservation, exact report, API removal-report and final runtime-removal assertions stay here; no live-owner distinction is dropped.
 */
export async function test_ttsc_clean_removes_the_runtime_directories_no_run_owns(): Promise<void> {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "clean-runs", private: true, workspaces: ["packages/*"] }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/waiting.ts": WAITING_PROGRAM,
    });
    const runs = runtimeRunsDirectory(root);
    const env = isolatedCacheEnvironment(root);
    const running = await startWaitingRun(root, "src/waiting.ts");
    let killed: IWaitingRun | undefined;
    let primaryFailure: unknown;
    try {
      killed = await startWaitingRun(root, "src/waiting.ts");
      await forceTerminate(killed.launcher.pid!);
      await forceTerminate(killed.program);
      const kept = runDirectory(runs, running.launcher.pid!);
      const terminated = runDirectory(runs, killed.launcher.pid!);
      assert.equal(fs.existsSync(terminated), true, killed.output());
      const result = TestProject.spawn(
        TestProject.TTSC_BIN,
        ["clean", "--cwd", root],
        { cwd: root, env },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(fs.existsSync(terminated), false, result.stdout);
      assert.equal(fs.existsSync(kept), true, result.stdout);
      assert.ok(
        result.stdout
          .split(/\r?\n/)
          .includes(
            `ttsc: kept ${path.relative(root, kept)}: a run that may still be in progress owns it`,
          ),
        result.stdout,
      );

      await forceTerminate(running.launcher.pid!);
      await forceTerminate(running.program);
      // The API reports what it removed by an absolute path, which may spell the
      // directory through the cwd as given or as the filesystem names it.
      const runtime = path.dirname(runs);
      const spellings = new Set([
        runtime,
        fs.realpathSync(runtime),
        fs.realpathSync.native(runtime),
      ]);
      assert.ok(
        new TtscCompiler({ cwd: root, env })
          .clean()
          .some((removed) => spellings.has(removed)),
        "TtscCompiler.clean() did not report the runtime directory",
      );
      assert.equal(fs.existsSync(runtime), false);
    } catch (error) {
      primaryFailure = error;
      throw error;
    } finally {
      const outcomes = await Promise.allSettled([
        stopWaitingRun(running),
        ...(killed === undefined ? [] : [stopWaitingRun(killed)]),
      ]);
      const failures = outcomes.filter((outcome) => outcome.status === "rejected");
      if (failures.length !== 0) throw new AggregateError(
        [...(primaryFailure === undefined ? [] : [primaryFailure]), ...failures.map((failure) => failure.reason)], "waiting pair cleanup failed",
      );
    }
  }
