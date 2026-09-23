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
