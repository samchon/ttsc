import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../../../../packages/ttsc/lib/index.js";
import {
  WAITING_PROGRAM,
  forceTerminate,
  runDirectory,
  runtimeRunsDirectory,
  startWaitingRun,
} from "../../internal/ttsx-run";

/**
 * Verifies `ttsc clean` removes the ttsx runtime directories no run owns, and
 * keeps and reports the one of a run in progress.
 *
 * `ttsc clean` never looked at the runtime directory below the cache root, so
 * the directory a force-terminated run left there outlived every clean
 * (samchon/ttsc#1579). It now removes each run directory whose owners are all
 * gone, while a run still in progress keeps its own; with none in progress,
 * the runtime directory goes whole, through `TtscCompiler.clean()` as well.
 *
 * 1. Start a waiting run and keep it. Start a second, and force-terminate both of
 *    its processes.
 * 2. Run `ttsc clean`, and assert the terminated directory is removed, and the
 *    running one is kept and reported.
 * 3. Force-terminate the kept run, call `TtscCompiler.clean()`, and assert it
 *    removed the runtime directory whole.
 */
export const test_ttsc_clean_removes_the_runtime_directories_no_run_owns =
  async (): Promise<void> => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "clean-runs", private: true }),
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
    const running = await startWaitingRun(root, "src/waiting.ts");
    try {
      const killed = await startWaitingRun(root, "src/waiting.ts");
      await forceTerminate(killed.launcher.pid!);
      await forceTerminate(killed.program);
      const kept = runDirectory(runs, running.launcher.pid!);
      const terminated = runDirectory(runs, killed.launcher.pid!);
      assert.equal(fs.existsSync(terminated), true, killed.output());
      const result = TestProject.spawn(
        TestProject.TTSC_BIN,
        ["clean", "--cwd", root],
        { cwd: root },
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
        new TtscCompiler({ cwd: root })
          .clean()
          .some((removed) => spellings.has(removed)),
        "TtscCompiler.clean() did not report the runtime directory",
      );
      assert.equal(fs.existsSync(runtime), false);
    } finally {
      await forceTerminate(running.launcher.pid!);
      await forceTerminate(running.program);
    }
  };
