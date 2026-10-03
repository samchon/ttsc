import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runPooledWorker } from "../../../../internal/unplugin/internal/pooled-session/runPooledWorker";

/**
 * Verifies an adoption a pooled worker could not prove does not spend the bound
 * on attempts, which stays for a project that keeps moving
 * (samchon/ttsc#1390).
 *
 * The bound counts the attempts that compiled here. A publication this worker
 * cannot prove, because a file outside the project that a plugin reported
 * changed after it was published, says nothing about the project moving, and
 * the attempt after it compiles that state here. Counted, it left one attempt
 * for a project that then moved once, and the delivery ended in an unstable
 * verdict a second compile resolves.
 *
 * 1. Publish a project state from a worker process while a plugin's file outside
 *    the project reads `first`, then change that file to `second`.
 * 2. Deliver in this process: the first attempt adopts the publication and cannot
 *    prove it, and the project moves while the second attempt compiles the same
 *    state here.
 * 3. Assert the delivery serves the moved project's current content from a third
 *    attempt's compile.
 *
 * @evidence contracts/testing.md#behavioral-verification Publication costs two compiles, stale external adoption is refused, project moves at compile three, and current PLUGIN:SECOND is delivered at count four.
 * @evidence contracts/testing.md#independent-expectations External first/second literals and fixture one-byte run log distinguish fresh state and attempts actually compiled.
 * @evidence contracts/testing.md#distinguishing-cases Unprovable external publication does not spend project-movement bound; a subsequent real project edit does.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_pooled_adoption_leaves_the_retry_bound_to_the_project is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Real native producer and separate Node workers exchange session publications for unprovable external publication does not spend project-movement bound; a subsequent real project edit does. In-process cache calls cannot establish cross-process locks, publication transport or adoption.
 * @evidence contracts/e2e.md#shared-execution One fixture project and private session publication store are reused across this case's workers/attempts. Native artifact builds use shared cache identity; separate workers are needed for publication/adoption, and changed state or producer inputs legitimately require the compile counts above.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project, run log and session/store roots prevent other workers' publications from satisfying this case. Worker processes complete before assertions inspect state, except the explicitly killed producer in the recovery case. Tracked roots are removed at process exit; cache instances used directly here have no explicit finally disposal, and abrupt cancellation is not exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Publication costs two compiles, stale external adoption is refused, project moves at compile three, and current PLUGIN:SECOND is delivered at count four. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_pooled_adoption_leaves_the_retry_bound_to_the_project(): Promise<void> {
  const {
    createTtscTransformCache,
    resolveOptions,
    shareTtscTransformCache,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const external = path.join(
    TestProject.tmpdir("ttsc-unplugin-pooled-bound-external-"),
    "helper.ts",
  );
  fs.writeFileSync(external, "first\n", "utf8");
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-pooled-bound-log-"),
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
  fs.writeFileSync(moved, "export const extra = 1;\n");
  const session = TestProject.tmpdir("ttsc-unplugin-pooled-bound-session-");
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);
  const main = TestUnpluginProject.mainFile(root);

  const published = await runPooledWorker({ file: main, session });
  assert.equal(published.error, undefined, published.error);
  // The worker learns the file the plugin reports from its first compile, and
  // publishes the second, which witnessed it (samchon/ttsc#1541).
  assert.equal(compiles(), 2, "the state is compiled and published");
  fs.writeFileSync(external, "second\n", "utf8");

  // The project moves as this process reads it back after its own compile,
  // which is the second attempt's: the first adopted.
  let movedAt: number | undefined;
  const cache = createTtscTransformCache({
    readFile: (location: string) => {
      const contents = fs.readFileSync(location);
      if (
        movedAt === undefined &&
        compiles() === 3 &&
        path.resolve(location) === path.resolve(moved)
      ) {
        movedAt = compiles();
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
  assert.equal(movedAt, 3, "the project moved under this process's compile");
  assert.match(result?.code ?? "", /PLUGIN:SECOND/, "the current content");
  assert.equal(compiles(), 4, "from the third attempt's compile");
}
