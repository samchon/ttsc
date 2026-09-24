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
 * Verifies a pooled worker refuses another worker's compile made under another
 * Go build environment, and compiles with the plugin binary its own environment
 * builds (samchon/ttsc#1493).
 *
 * A plugin's binary is keyed on its Go source and on the environment it is
 * built in: the Go compiler, `go env`, and cgo's toolchain. Since
 * samchon/ttsc#1487 a publication carried the source's state and the adopter
 * proved it, but not the environment, so a worker started under another
 * `GOFLAGS` adopted output its binary would not have produced. The state the
 * envelope reports for each source directory now covers the environment, and
 * the adopter proves it like any universal input.
 *
 * 1. Publish the project's state from a worker process under the environment the
 *    suite runs in.
 * 2. Deliver in this process, under another `GOFLAGS`, through the same session,
 *    and assert it refuses the publication and compiles once of its own.
 */
export async function test_transformttsc_pooled_workers_refuse_a_publication_of_another_build_environment(): Promise<void> {
  const {
    createTtscTransformCache,
    resolveOptions,
    shareTtscTransformCache,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-pooled-environment-log-"),
    "compiles.bin",
  );
  const root = TestUnpluginProject.createProject({
    plugins: [
      {
        transform: "./plugin.cjs",
        name: "runs",
        operation: "count-runs",
        runLog,
      },
      { transform: "./plugin.cjs", name: "upper", operation: "go-uppercase" },
    ],
  });
  const session = TestProject.tmpdir("ttsc-unplugin-pooled-environment-");
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);
  const main = TestUnpluginProject.mainFile(root);

  // 1. The publication.
  const published = await runPooledWorker({ file: main, session });
  assert.equal(published.error, undefined, published.error);
  assert.match(published.code ?? "", /"PLUGIN"/);
  assert.equal(compiles(), 1, "the state compiles once and is published");

  // 2. Another environment.
  const previous = process.env.GOFLAGS;
  process.env.GOFLAGS = "-tags=ttsc_unplugin_environment_probe";
  try {
    const cache = createTtscTransformCache();
    shareTtscTransformCache(cache, session);
    const result = await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      resolveOptions(),
      undefined,
      cache,
    );
    assert.match(result?.code ?? "", /"PLUGIN"/);
    assert.equal(compiles(), 2, "a compile of its own");
  } finally {
    if (previous === undefined) delete process.env.GOFLAGS;
    else process.env.GOFLAGS = previous;
  }
}
