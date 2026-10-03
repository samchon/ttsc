import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { isolatedCacheEnvironment } from "../../../internal/ttsc/internal/isolated-cache-environment";
import {
  WAITING_PROGRAM,
  forceTerminate,
  isRunning,
  runDirectory,
  runtimeRunsDirectory,
  startWaitingRun,
  stopWaitingRun,
} from "../../../internal/ttsc/internal/ttsx-run";

/**
 * Verifies a run removes the runtime directory a force-terminated run left in
 * the cache root, and never one whose program still runs.
 *
 * A run removes its own directory below `ttsx/project` when it ends, which a
 * run terminated outright never does, and nothing else removed it: each such
 * run left its emit and virtual layout in the cache root for good
 * (samchon/ttsc#1579). A run now records its processes as the owners of its
 * directory, and removes the directories whose owners are all gone. Where
 * terminating the launcher leaves the program running, as on POSIX, the program
 * owns the directory too, so a later run must not take it from under it.
 *
 * 1. Start a program that prints its pid and waits, force-terminate the launcher,
 *    and assert the run's directory remains.
 * 2. Run another program to completion. If the first program still runs, assert
 *    the first run's directory remains.
 * 3. Force-terminate the first program, run a program to completion, and assert no
 *    run directory remains.
 *
 * @evidence contracts/testing.md#behavioral-verification A real waiting run is killed at the launcher, then later completed runs must preserve any surviving program owner and finally remove all generations after that program is killed.
 * @evidence contracts/testing.md#independent-expectations The program reports its actual PID; native liveness decides whether the live-child preservation branch applies. Directory observations and literal done output are independent ownership oracles.
 * @evidence contracts/testing.md#distinguishing-cases Launcher-dead/program-live and all-owners-dead states distinguish preservation from reclamation; platform-native child survival determines the first state rather than assuming POSIX behavior everywhere.
 * @evidence contracts/testing.md#execution-ownership The matching async E2E entry owns one waiting pair and two completion sessions; helper source is fixture input, and the conditional live-child branch is not executed on every platform.
 * @evidence contracts/e2e.md#necessary-boundary Forced termination bypasses product cleanup and actual surviving child admission must protect the shared output; synthetic owner records alone cannot demonstrate that lifecycle.
 * @evidence contracts/e2e.md#shared-execution All sessions reuse one project and isolated cache; waiting and two later preparation lifetimes establish successive ownership states. Equivalent compiler preparation is still repeated by the current harness.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture declares its own workspace boundary so an ancestor installation cannot select an external cache. Finally releases the authenticated waiting program through its fixture nonce channel and awaits owned launcher/stdio closure rather than reusing a formerly killed program PID even if a state assertion fails; startup failures close their own tree before rejecting. Deliberate launcher-only and later program kills remain separate from final cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Post-kill directory retention, conditional live-child preservation, each done status/output and final empty run index remain; native child-survival coverage is explicitly conditional.
 */
export async function test_ttsx_reclaims_the_directory_of_a_force_terminated_run(): Promise<void> {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "killed-run", private: true, workspaces: ["packages/*"] }),
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
      "src/done.ts": `console.log("done");\nexport {};\n`,
    });
    const runs = runtimeRunsDirectory(root);
    const runToCompletion = (): void => {
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, "src/done.ts"],
        { cwd: root, env: isolatedCacheEnvironment(root) },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "done");
    };

    const killed = await startWaitingRun(root, "src/waiting.ts");
    let primaryFailure: unknown;
    try {
      await forceTerminate(killed.launcher.pid!);
      const directory = runDirectory(runs, killed.launcher.pid!);
      assert.equal(fs.existsSync(directory), true, killed.output());

      runToCompletion();
      if (isRunning(killed.program)) {
        assert.equal(
          fs.existsSync(directory),
          true,
          "a later run removed the directory of a program still running",
        );
      }

      await forceTerminate(killed.program);
      runToCompletion();
      assert.deepEqual(
        fs.readdirSync(runs),
        [],
        "the directory of a force-terminated run remained",
      );
    } catch (error) {
      primaryFailure = error;
      throw error;
    } finally {
      try {
        await stopWaitingRun(killed);
      } catch (cleanupError) {
        if (primaryFailure !== undefined) throw new AggregateError(
          [primaryFailure, cleanupError], "terminated run failed and cleanup failed",
        );
        throw cleanupError;
      }
    }
  }
