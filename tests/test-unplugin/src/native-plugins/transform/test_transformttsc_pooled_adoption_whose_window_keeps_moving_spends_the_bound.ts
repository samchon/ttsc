import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runPooledWorker } from "../../internal/pooled-session/runPooledWorker";

/**
 * Verifies an adoption whose own window moved spends the bound on attempts, as
 * a compile whose window moved does, and compiles nothing to spend it
 * (samchon/ttsc#1479).
 *
 * A pooled worker re-adopts a publication its own window moved around, since
 * the publication held and only the project moved. That attempt is then the
 * project moving, exactly as a compile here would have been, so it counts
 * toward the bound: a project whose window keeps moving ends in the unstable
 * verdict after the same two attempts either way, rather than compiling a state
 * the pool already published for each of them.
 *
 * 1. Publish a project state from a worker process.
 * 2. Deliver in this process, touching a declared source during every attempt's
 *    walk, after the walk read it, so every attempt's window moves while no
 *    content changes.
 * 3. Assert the delivery ends in the unstable verdict, and nothing compiled in
 *    this process.
 *
 * @evidence contracts/testing.md#behavioral-verification Repeated alpha timestamp changes during omega reads reject with reusable-generation error while count remains one published compile.
 * @evidence contracts/testing.md#independent-expectations Injected touches change capture window without source bytes changing; unchanged run log exposes adoption-only attempts.
 * @evidence contracts/testing.md#distinguishing-cases Every adoption window moves, unlike the one-move retry companion; bounded refusal must not trigger local compile.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_pooled_adoption_whose_window_keeps_moving_spends_the_bound is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Real native producer and separate Node workers exchange session publications for every adoption window moves, unlike the one-move retry companion; bounded refusal must not trigger local compile. In-process cache calls cannot establish cross-process locks, publication transport or adoption.
 * @evidence contracts/e2e.md#shared-execution One fixture project and private session publication store are reused across this case's workers/attempts. Native artifact builds use shared cache identity; separate workers are needed for publication/adoption, and changed state or producer inputs legitimately require the compile counts above.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project, run log and session/store roots prevent other workers' publications from satisfying this case. Worker processes complete before assertions inspect state, except the explicitly killed producer in the recovery case. Tracked roots are removed at process exit; cache instances used directly here have no explicit finally disposal, and abrupt cancellation is not exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Repeated alpha timestamp changes during omega reads reject with reusable-generation error while count remains one published compile. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_pooled_adoption_whose_window_keeps_moving_spends_the_bound(): Promise<void> {
  const {
    createTtscTransformCache,
    resolveOptions,
    shareTtscTransformCache,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-pooled-moving-log-"),
    "compiles.bin",
  );
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.compilerOptions.plugins = [
    {
      transform: "./plugin.cjs",
      name: "runs",
      operation: "count-runs",
      runLog,
    },
  ];
  fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2), "utf8");
  // The walk reads the project's files in sorted order, so `alpha.ts` is read
  // before `omega.ts`, and a touch while `omega.ts` is read lands after
  // `alpha.ts` was.
  const touched = path.join(root, "src", "alpha.ts");
  const trigger = path.join(root, "src", "omega.ts");
  fs.writeFileSync(touched, "export const alpha = 1;\n");
  fs.writeFileSync(trigger, "export const omega = 1;\n");
  const session = TestProject.tmpdir("ttsc-unplugin-pooled-moving-session-");
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);
  const main = TestUnpluginProject.mainFile(root);

  const published = await runPooledWorker({ file: main, session });
  assert.equal(published.error, undefined, published.error);
  assert.equal(compiles(), 1, "the state compiles once and is published");

  // Every read of `omega.ts` moves `alpha.ts` to a time of its own.
  let touches = 0;
  const cache = createTtscTransformCache({
    readFile: (location: string) => {
      if (path.resolve(location) === path.resolve(trigger)) {
        touches += 1;
        const later = new Date(Date.now() + touches * 60_000);
        fs.utimesSync(touched, later, later);
      }
      return fs.readFileSync(location);
    },
  });
  shareTtscTransformCache(cache, session);
  await assert.rejects(
    transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      resolveOptions(),
      undefined,
      cache,
    ),
    /could not capture a reusable transform generation/,
  );
  assert.equal(compiles(), 1, "the bound was spent on adoptions alone");
}
