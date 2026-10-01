import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies a new pass grants an unstable generation one fresh attempt.
 *
 * The two terminal verdict kinds part company across a pass boundary. A failed
 * compile is the host's answer about inputs it read, so a new pass replays it.
 * An unstable generation is the adapter losing a race for a coherent snapshot,
 * which a later attempt may win, so a new pass must try again, the fresh
 * attempt the per-pass cache clear used to provide. The run log counts
 * attempts: the compile succeeds and only the walk around it is torn.
 *
 * 1. Fail the project walk during a pass, assert the pass spends its bounded
 *    attempts, and assert a second delivery in that pass starts none.
 * 2. Open a new pass with the walk still failing, and assert it starts a fresh
 *    attempt.
 * 3. Open another pass with the walk recovered, and assert it produces a real
 *    generation.
 *
 * @evidence contracts/testing.md#behavioral-verification A failing post-compile directory walk must reject after bounded attempts, replay the exact terminal Error within one pass without another capture, start fresh attempts in a new pass, and succeed after the blocked walk recovers.
 * @evidence contracts/testing.md#independent-expectations The injected readdir failure makes a coherent snapshot impossible without changing the native successful output. Literal after-2-attempts text, independently counted run-log bytes and Error identity distinguish bounded capture from unlimited retries or stale replay. The initial count permits at least two actual captures rather than assuming exact internal probing frequency.
 * @evidence contracts/testing.md#distinguishing-cases Same-pass terminal replay, next-pass retry with still-broken walk and repaired-walk new-pass recovery are distinct states. This entry covers instability rather than the native diagnostic terminal-verdict batch.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_a_new_pass_retries_an_unstable_generation in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution One createCacheProject and shared sidecar artifact serve every pass through one cache. Post-compile walk failure is a per-cache seam, so native installation/build remains reusable; actual additional captures are required to prove new-pass retry and eventual recovery.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique fixture and log roots isolate the transient directory. blocked changes only before the recovery pass, retaining a real failed state for prior waves; finally resets the cache. Temporary roots belong to TestProject until runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_a_new_pass_retries_an_unstable_generation; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_a_new_pass_retries_an_unstable_generation(): Promise<void> {
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 2, graphFanout: 2 });
  const transientDirectory = path.join(project.root, "src", "transient");
  fs.mkdirSync(transientDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(transientDirectory, "hidden.ts"),
    "declare const hiddenDuringSnapshot: string;\n",
    "utf8",
  );
  // The walk of this one directory fails for as long as it stays blocked, so
  // no attempt can ever prove a coherent snapshot and the generation stays
  // terminal without anything else about the project changing.
  let blocked = true;
  const cache = api.createTtscTransformCache({
    readdir: (location: string) => {
      if (
        path.resolve(location) === transientDirectory &&
        blocked &&
        fs.existsSync(project.runLog)
      ) {
        throw new Error("pass-boundary project snapshot failure");
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const modules = projectModules(project.root);
  const options = api.resolveOptions({
    project: path.join(project.root, "tsconfig.json"),
  });
  const attempts = () =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;
  const deliver = (file: string) =>
    api.transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );

  try {
    api.beginTtscTransformBuild(cache);
    let terminal: Error | undefined;
    await assert.rejects(
      () => deliver(modules[0]!),
      (error: Error) => {
        terminal = error;
        assert.match(error.message, /after 2 attempts/);
        return true;
      },
    );
    const spent = attempts();
    assert.ok(spent >= 2, "the first pass must spend its bounded attempts");

    // Same pass, unchanged environment: the verdict answers without recompiling.
    await assert.rejects(
      () => deliver(modules[1]!),
      (error: Error) => error === terminal,
    );
    assert.equal(
      attempts(),
      spent,
      "an unchanged environment must not start another wave inside the pass",
    );

    // A new pass is a fresh attempt, even though nothing about the project
    // moved. This is the branch the per-pass clear used to provide.
    api.beginTtscTransformBuild(cache);
    await assert.rejects(() => deliver(modules[0]!), /after 2 attempts/);
    assert.ok(
      attempts() > spent,
      "a new pass must grant an unstable generation a fresh attempt",
    );

    // And recovery still lands once the walk stops failing.
    blocked = false;
    api.beginTtscTransformBuild(cache);
    assert.ok(
      await deliver(modules[0]!),
      "a recovered project walk must produce a real generation",
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}
