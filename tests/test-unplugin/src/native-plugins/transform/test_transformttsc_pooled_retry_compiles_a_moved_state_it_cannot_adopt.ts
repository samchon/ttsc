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
 * Verifies a pooled delivery whose last attempt adopted a compile it could not
 * prove compiles that state itself instead of ending in an unstable verdict
 * (samchon/ttsc#1390).
 *
 * The attempt bound is for a project that keeps moving. A retry whose project
 * moved to another state adopts that state's publication, and a publication
 * this worker cannot prove, because a file outside the project that a plugin
 * reported changed after it was published, says nothing about the project
 * moving: ending the delivery there would replay an unstable verdict until the
 * environment changed again, where compiling the state resolves it.
 *
 * 1. Publish two project states from worker processes, both while a plugin's file
 *    outside the project read `first`; restore the first state and change that
 *    file to `second`.
 * 2. Deliver in this process, which adopts the first state's publication while the
 *    project moves to the second, and then adopts the second state's, which
 *    this worker cannot prove either.
 * 3. Assert the delivery serves the file's current content from a compile of its
 *    own.
 */
export async function test_transformttsc_pooled_retry_compiles_a_moved_state_it_cannot_adopt(): Promise<void> {
  const {
    createTtscTransformCache,
    resolveOptions,
    shareTtscTransformCache,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const external = path.join(
    TestProject.tmpdir("ttsc-unplugin-pooled-moved-external-"),
    "helper.ts",
  );
  fs.writeFileSync(external, "first\n", "utf8");
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-pooled-moved-log-"),
    "compiles.bin",
  );
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const relative = path.relative(root, external);
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.compilerOptions.plugins = [
    {
      transform: "./plugin.cjs",
      name: "reader",
      operation: "read-configured-helper",
      path: relative,
    },
    {
      transform: "./plugin.cjs",
      name: "reporter",
      operation: "emit-dependencies",
      dependencies: [relative.split(path.sep).join("/")],
    },
    {
      transform: "./plugin.cjs",
      name: "runs",
      operation: "count-runs",
      runLog,
    },
  ];
  fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2), "utf8");
  const moved = path.join(root, "src", "extra.ts");
  const session = TestProject.tmpdir("ttsc-unplugin-pooled-moved-session-");
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);
  const main = TestUnpluginProject.mainFile(root);

  for (const content of [
    "export const extra = 1;\n",
    "export const extra = 2;\n",
  ]) {
    fs.writeFileSync(moved, content);
    const result = await runPooledWorker({ file: main, session });
    assert.equal(result.error, undefined, result.error);
  }
  assert.equal(compiles(), 2, "each state compiles once and is published");
  fs.writeFileSync(moved, "export const extra = 1;\n");
  fs.writeFileSync(external, "second\n", "utf8");

  // The first read takes the snapshot that names the first state; the project
  // moves to the second as the attempt reads it back.
  let reads = 0;
  const cache = createTtscTransformCache({
    readFile: (location: string) => {
      const contents = fs.readFileSync(location);
      if (path.resolve(location) === path.resolve(moved) && ++reads === 2) {
        fs.writeFileSync(moved, "export const extra = 2;\n");
      }
      return contents;
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
  assert.match(result?.code ?? "", /PLUGIN:SECOND/, "the current content");
  assert.equal(compiles(), 3, "from a compile of its own");
}
