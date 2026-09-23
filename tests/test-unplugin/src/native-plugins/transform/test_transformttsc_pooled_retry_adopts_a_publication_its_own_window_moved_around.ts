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
 * Verifies a pooled worker whose own window moved around a publication it
 * adopted adopts that publication again, rather than compiling a state the pool
 * already compiled and proved (samchon/ttsc#1479).
 *
 * An adopted attempt fails either because the publication does not hold on this
 * worker's disk or because the worker's own window moved around it. Every
 * failed adoption used to be refused for the same state, so an event that
 * changed nothing, a touched source or an FSEvents stream replaying the last
 * edit, made the retry compile the whole project again: on a Turbopack pool, an
 * unchanged rebuild compiled a state another worker had just published. Only a
 * publication refuted here is refused now; a moved window is retried like a
 * compile's, and the retry reads the same state and adopts it.
 *
 * 1. Publish a project state from a worker process.
 * 2. Deliver in this process, touching a declared source while the first attempt
 *    walks the project, after the walk read it, so the walk that proves the
 *    adoption sees that source move while no content changed.
 * 3. Assert the delivery serves the published compile, and nothing compiled in
 *    this process.
 */
export async function test_transformttsc_pooled_retry_adopts_a_publication_its_own_window_moved_around(): Promise<void> {
  const {
    createTtscTransformCache,
    resolveOptions,
    shareTtscTransformCache,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-pooled-window-log-"),
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
  const session = TestProject.tmpdir("ttsc-unplugin-pooled-window-session-");
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);
  const main = TestUnpluginProject.mainFile(root);

  const published = await runPooledWorker({ file: main, session });
  assert.equal(published.error, undefined, published.error);
  assert.equal(compiles(), 1, "the state compiles once and is published");

  // The first read of `omega.ts` is the first attempt's walk before it claims
  // the state, and only that attempt's window moves.
  let reads = 0;
  const cache = createTtscTransformCache({
    readFile: (location: string) => {
      if (path.resolve(location) === path.resolve(trigger)) {
        reads += 1;
        if (reads === 1) {
          const later = new Date(Date.now() + 60_000);
          fs.utimesSync(touched, later, later);
        }
      }
      return fs.readFileSync(location);
    },
  });
  shareTtscTransformCache(cache, session);
  const result = await transformTtsc(
    main,
    fs.readFileSync(main, "utf8"),
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(reads > 2, "a second attempt walked the project again");
  assert.notEqual(result?.code, undefined, "the delivery is served");
  assert.equal(
    compiles(),
    1,
    "from the pool's publication, compiled nowhere else",
  );
}
