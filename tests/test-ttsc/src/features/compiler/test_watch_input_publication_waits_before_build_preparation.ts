import assert from "node:assert/strict";
import fs from "node:fs";

import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { BuildTiming } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildTiming";
import { runBuild } from "../../../../../packages/ttsc/src/compiler/internal/build/runBuild";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies build preparation waits for both watch publication checkpoints.
 *
 * A worker must establish its baseline before the producer continues, while existing synchronous callers must retain synchronous results and failures.
 *
 * 1. Pause a plugin-free build at its source and project-input publications.
 * 2. Assert each checkpoint blocks the next phase and reject before compilation.
 * 3. Contrast synchronous completion, promise refusal and rejected publication.
 *
 * @evidence contracts/testing.md#behavioral-verification Real runBuild.async, resolveExecutionContext and prepareBuildExecution calls distinguish awaited source/project handoffs from premature phase advancement; rejection stops before the native compile dispatcher.
 * @evidence contracts/testing.md#independent-expectations Authored deferred promises determine completion authority; the empty project independently requires empty plugin roots and an empty dependency population rooted at its physical directory.
 * @evidence contracts/testing.md#distinguishing-cases Two sequential pending handoffs, successful synchronous preparation, synchronous promise refusal, an inline source-handler throw and an asynchronous source-handler rejection distinguish completion and setup-failure paths. Compiler behavior and real worker registration belong to watch E2E coverage.
 * @evidence contracts/testing.md#execution-ownership This exported source unit reads an owned temporary config with plugins disabled and process.execPath as an unused existing binary. It rejects the project publication before compilation and starts no compiler, watcher, worker, consumer or native build.
 */
export async function test_watch_input_publication_waits_before_build_preparation(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.createProject({ "tsconfig.json": '{"files":[]}' }),
  );
  const options = {
    binary: process.execPath,
    cwd: root,
    plugins: false as const,
    skipDiagnosticsCheck: true,
  };
  const source = Promise.withResolvers<void>();
  const project = Promise.withResolvers<void>();
  const projectStarted = Promise.withResolvers<void>();
  const failure = new Error("registration refused");
  const events: string[] = [];
  void project.promise.catch(() => {});
  const operation = runBuild
    .async({
      ...options,
      onWatchInputs: (inputs) => {
        assert.deepEqual(inputs, []);
        events.push("source");
        return source.promise;
      },
      onProjectInputs: (snapshot) => {
        assert.equal(snapshot.root, root);
        assert.deepEqual(snapshot.files, []);
        assert.deepEqual(snapshot.globs, []);
        events.push("project");
        projectStarted.resolve();
        return project.promise;
      },
    })
    .then(
      () => {
        throw new Error("a rejected publication must prevent compilation");
      },
      (error: unknown) => error,
    );
  try {
    assert.deepEqual(events, ["source"]);
    await Promise.resolve();
    assert.deepEqual(events, ["source"]);
    source.resolve();
    await Promise.race([
      projectStarted.promise,
      operation.then((error) => {
        throw error;
      }),
    ]);
    assert.deepEqual(events, ["source", "project"]);
    let completed = false;
    void operation.then(
      () => {
        completed = true;
      },
      () => {
        completed = true;
      },
    );
    await Promise.resolve();
    assert.equal(completed, false);
    project.reject(failure);
    assert.equal(await operation, failure);

    const syncEvents: string[] = [];
    const execution = BuildExecution.resolveExecutionContext({
      ...options,
      onWatchInputs: () => syncEvents.push("source"),
    });
    assert.equal(execution.pluginSetupFailure, undefined);
    const prepared = BuildExecution.prepareBuildExecution(
      { ...options, onProjectInputs: () => syncEvents.push("project") },
      BuildTiming.createBuildTiming(options),
      execution,
      process.hrtime.bigint(),
    );
    assert.equal(prepared.result, undefined);
    assert.deepEqual(syncEvents, ["source", "project"]);
    assert.throws(
      () =>
        BuildExecution.prepareBuildExecution(
          { ...options, onProjectInputs: () => Promise.reject(failure) },
          BuildTiming.createBuildTiming(options),
          execution,
          process.hrtime.bigint(),
        ),
      /asynchronous watch input publication requires an asynchronous build entry/,
    );
    const refused = BuildExecution.resolveExecutionContext({
      ...options,
      onWatchInputs: () => Promise.reject(failure),
    });
    assert.equal(refused.pluginSetupFailure?.status, 2);
    assert.match(
      refused.pluginSetupFailure?.stderr ?? "",
      /asynchronous build entry/,
    );
    const thrown = BuildExecution.resolveExecutionContext({
      ...options,
      onWatchInputs: () => {
        throw failure;
      },
    });
    assert.equal(thrown.pluginSetupFailure?.status, 2);
    assert.equal(thrown.pluginSetupFailure?.stderr, "registration refused\n");
    const rejected = await BuildExecution.resolveExecutionContextAsync({
      ...options,
      onWatchInputs: () => Promise.reject(failure),
    });
    assert.equal(rejected.pluginSetupFailure?.status, 2);
    assert.equal(rejected.pluginSetupFailure?.stderr, "registration refused\n");
  } finally {
    source.resolve();
    project.reject(failure);
    await operation;
    fs.rmSync(root, { recursive: true, force: true });
  }
}
