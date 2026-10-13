import assert from "node:assert/strict";
import fs from "node:fs";

import { loadProjectPlugins } from "../../../../../packages/ttsc/src/plugin/internal/load/loadProjectPlugins";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies empty plugin selection retains its publication completion boundary.
 *
 * Disabling plugins still replaces a watch owner's previous source population,
 * so loading must await that replacement and preserve rejection behavior.
 *
 * 1. Pause actual plugin loading with an explicitly empty selected population.
 * 2. Assert loading remains pending until publication finishes and inspect it.
 * 3. Contrast synchronous handlers, promise refusal and rejected registration.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual synchronous and asynchronous loader entries publish empty roots once; deferred completion prevents an early result, while refusal and rejection remain observable failures.
 * @evidence contracts/testing.md#independent-expectations The authored plugin-disabled config independently selects no native plugins or source states; an external deferred promise determines when registration is complete.
 * @evidence contracts/testing.md#distinguishing-cases Empty selection, pending and completed publication, absent and synchronous handlers, inline throw, synchronous promise refusal and asynchronous rejection cover the loader's no-entry handoff. Nonempty Go package/source publication belongs to native plugin watch E2E tests.
 * @evidence contracts/testing.md#execution-ownership This exported source unit loads a tracked temporary config with entries false, so no descriptor evaluator, Go tool, native artifact or watcher starts. The owned project is removed after all pending operations settle.
 */
export async function test_plugin_loader_awaits_empty_selection_publication(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.createProject({ "tsconfig.json": '{"files":[]}' }),
  );
  const options = {
    binary: process.execPath,
    cwd: root,
    entries: false as const,
  };
  const handoff = Promise.withResolvers<void>();
  let calls = 0;
  let completed = false;
  const operation = loadProjectPlugins
    .async({
      ...options,
      onWatchInputs: (inputs, identities) => {
        assert.deepEqual(inputs, []);
        assert.equal(identities, undefined);
        ++calls;
        return handoff.promise;
      },
    })
    .then((result) => {
      completed = true;
      return result;
    });
  try {
    assert.equal(calls, 1);
    await Promise.resolve();
    assert.equal(completed, false);
    handoff.resolve();
    const result = await operation;
    assert.deepEqual(result.nativePlugins, []);
    assert.deepEqual(result.pluginSources, {});
    assert.equal(result.project.root, root);
    assert.equal(calls, 1);
    assert.deepEqual(loadProjectPlugins(options).nativePlugins, []);
    let synchronous = false;
    loadProjectPlugins({
      ...options,
      onWatchInputs: () => {
        synchronous = true;
      },
    });
    assert.equal(synchronous, true);
    const failure = new Error("empty registration refused");
    assert.throws(
      () =>
        loadProjectPlugins({
          ...options,
          onWatchInputs: () => {
            throw failure;
          },
        }),
      (error) => error === failure,
    );
    assert.throws(
      () =>
        loadProjectPlugins({
          ...options,
          onWatchInputs: () => Promise.reject(failure),
        }),
      /asynchronous build entry/,
    );
    await assert.rejects(
      loadProjectPlugins.async({
        ...options,
        onWatchInputs: () => Promise.reject(failure),
      }),
      (error) => error === failure,
    );
  } finally {
    handoff.resolve();
    await operation;
    fs.rmSync(root, { recursive: true, force: true });
  }
}
