import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../internal/transform-project-cache/createCacheProject";
import { externalSourceModules } from "../../../internal/transform-project-cache/externalSourceModules";

/**
 * Verifies a persistently unreadable project walk fails after the retry bound
 * and recovers once the walk does.
 *
 * A walk that keeps failing can never produce a coherent snapshot, so retrying
 * without limit would recompile forever. The failure must end after its bounded
 * attempts and stay terminal while the environment is unchanged, yet a
 * confirmed recovery of the walk must still replace it.
 *
 * 1. Make one project directory unreadable for every listing after the compile
 *    starts.
 * 2. Deliver and assert both attempts exercise the failed walk, and an unchanged
 *    environment starts no further wave.
 * 3. Restore the directory and assert the next delivery, from a later turn,
 *    replaces the failed generation.
 *
 * @evidence contracts/testing.md#behavioral-verification Persistently denied listing rejects after two compiles, sibling requests reuse the same terminal error without another wave, and restored listing costs one recovery compile.
 * @evidence contracts/testing.md#independent-expectations Explicit listing seam, terminal object identity and independent native run log distinguish bounded failure from fresh retry.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged failed environment stays terminal; confirmed recovery on a later turn replaces it, including outside-walk sibling requests.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_persistent_incomplete_project_snapshot_fails_after_bounded_attempts in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Persistently denied listing rejects after two compiles, sibling requests reuse the same terminal error without another wave, and restored listing costs one recovery compile. These assertions remain in test_transformttsc_persistent_incomplete_project_snapshot_fails_after_bounded_attempts, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_persistent_incomplete_project_snapshot_fails_after_bounded_attempts(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({
    externalSourceOutputs: 2,
    fileCount: 2,
    graphFanout: 2,
  });
  const transientDirectory = path.join(project.root, "src", "transient");
  fs.mkdirSync(transientDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(transientDirectory, "hidden.ts"),
    "declare const hiddenDuringSnapshot: string;\n",
    "utf8",
  );
  let failures = 0;
  let blocked = true;
  const cache = createTtscTransformCache({
    readdir: (location: string) => {
      if (
        path.resolve(location) === transientDirectory &&
        blocked &&
        fs.existsSync(project.runLog)
      ) {
        failures += 1;
        throw new Error("persistent project snapshot failure");
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const main = path.join(project.root, "src", "mod0.ts");
  const options = resolveOptions({
    project: path.join(project.root, "tsconfig.json"),
  });
  let terminal: Error | undefined;
  await assert.rejects(
    () =>
      transformTtsc(
        main,
        fs.readFileSync(main, "utf8"),
        options,
        undefined,
        cache,
      ),
    (error: Error) => {
      terminal = error;
      assert.match(error.message, /after 2 attempts/);
      assert.match(error.message, /project\/directory-read-failed/);
      assert.match(error.message, /src\/transient/);
      return true;
    },
  );
  assert.ok(failures >= 3, "both attempts must exercise the failed walk");
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 2);
  assert.equal(cache.size, 1);

  for (const sibling of externalSourceModules(project.root, 2)) {
    await assert.rejects(
      () =>
        transformTtsc(
          sibling,
          fs.readFileSync(sibling, "utf8"),
          options,
          undefined,
          cache,
        ),
      (error: Error) => error === terminal,
    );
  }
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    2,
    "an unchanged failed environment must not start another attempt wave",
  );

  blocked = false;
  // A host delivers a recovered module from a later turn than the wave that
  // confirmed the failure, which is when that shared confirmation expires
  // (samchon/ttsc#1398).
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(
    await transformTtsc(
      main,
      fs.readFileSync(main, "utf8"),
      options,
      undefined,
      cache,
    ),
  );
  assert.equal(
    fs.readFileSync(project.runLog, "utf8").length,
    3,
    "a confirmed project-walk recovery must replace the failed generation",
  );
  assert.equal(cache.size, 1);
}
