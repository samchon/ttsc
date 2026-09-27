import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  WAITING_PROGRAM,
  forceTerminate,
  isRunning,
  runtimeRunsDirectory,
  startWaitingRun,
} from "../../internal/ttsx-run";

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
 */
export const test_ttsx_reclaims_the_directory_of_a_force_terminated_run =
  async (): Promise<void> => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "killed-run", private: true }),
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
        { cwd: root },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), "done");
    };

    const killed = await startWaitingRun(root, "src/waiting.ts");
    try {
      await forceTerminate(killed.launcher.pid!);
      const directory = path.join(runs, String(killed.launcher.pid));
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
    } finally {
      await forceTerminate(killed.program);
    }
  };
