import assert from "node:assert/strict";

import { PlaygroundCompilerLifecycle } from "../../../../packages/playground/lib/src/react/internal/PlaygroundCompilerLifecycle.js";

/**
 * Verifies Worker generation invalidation fences active and queued mutations.
 *
 * Cancelling an install RPC cannot undo MemFS writes that already completed. If
 * the matching dependency metadata survives, the next source can then skip the
 * reinstall needed by its empty or stale Worker.
 *
 * 1. A terminal boot failure fences active and queued dependency tasks.
 * 2. A source edit during a Worker reset clears that Worker's metadata.
 * 3. A source edit during an install RPC resets every mutated cache, after which
 *    the current source can install into the clean Worker.
 */
export const test_playground_compiler_lifecycle_fences_stale_dependency_tasks =
  async (): Promise<void> => {
    const lifecycle = new PlaygroundCompilerLifecycle();
    const oldGeneration = lifecycle.capture();
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstStarted = false;
    let firstCommitted = false;
    let secondStarted = false;

    const first = lifecycle.enqueue(async (generation) => {
      firstStarted = true;
      await firstBlocked;
      if (generation.isCurrent()) firstCommitted = true;
    });
    const second = lifecycle.enqueue(async () => {
      secondStarted = true;
    });

    await Promise.resolve();
    assert.equal(firstStarted, true);

    const replacement = lifecycle.invalidateIfCurrent(oldGeneration);
    assert.ok(replacement);
    assert.equal(
      lifecycle.invalidateIfCurrent(oldGeneration),
      undefined,
      "an obsolete failure cannot fence the replacement generation",
    );

    releaseFirst();
    await Promise.all([first, second]);
    assert.equal(firstCommitted, false);
    assert.equal(secondStarted, false);
    assert.equal(replacement.isCurrent(), true);

    let replacementCommitted = false;
    await lifecycle.enqueue(async (generation) => {
      assert.equal(generation.isCurrent(), true);
      replacementCommitted = true;
    });
    assert.equal(replacementCommitted, true);

    let sourceVersion = 0;
    let dependencyMetadata = "installed:A";
    let releaseReset!: () => void;
    let resetStarted!: () => void;
    const resetDidStart = new Promise<void>((resolve) => {
      resetStarted = resolve;
    });
    const resetBlocked = new Promise<void>((resolve) => {
      releaseReset = resolve;
    });
    const reset = lifecycle.resetWorkerIfCurrent(
      replacement,
      async () => {
        resetStarted();
        await resetBlocked;
      },
      () => {
        dependencyMetadata = "";
      },
    );
    await resetDidStart;
    sourceVersion++;
    releaseReset();
    assert.equal(await reset, true);
    assert.equal(sourceVersion, 1);
    assert.equal(
      dependencyMetadata,
      "",
      "a source change during reset cannot preserve the old Worker's metadata",
    );

    const beforeClientReplacement = lifecycle.capture();
    dependencyMetadata = "replacement-worker";
    let releaseStaleReset!: () => void;
    let staleResetStarted!: () => void;
    const staleResetDidStart = new Promise<void>((resolve) => {
      staleResetStarted = resolve;
    });
    const staleResetBlocked = new Promise<void>((resolve) => {
      releaseStaleReset = resolve;
    });
    const staleReset = lifecycle.resetWorkerIfCurrent(
      beforeClientReplacement,
      async () => {
        staleResetStarted();
        await staleResetBlocked;
      },
      () => {
        dependencyMetadata = "";
      },
    );
    await staleResetDidStart;
    lifecycle.invalidate();
    releaseStaleReset();
    assert.equal(await staleReset, false);
    assert.equal(
      dependencyMetadata,
      "replacement-worker",
      "a stale reset cannot clear replacement-generation metadata",
    );

    const installGeneration = lifecycle.capture();
    const installVersion = sourceVersion;
    let releaseInstall!: () => void;
    let installStarted!: () => void;
    const installDidStart = new Promise<void>((resolve) => {
      installStarted = resolve;
    });
    const installBlocked = new Promise<void>((resolve) => {
      releaseInstall = resolve;
    });
    let workerFiles = new Set(["A/compiler.d.ts"]);
    let installedPackages = new Map([["A", "1.0.0"]]);
    let dependencyRoots = new Set(["A"]);
    let editorLibs: Record<string, string> = {
      "file:///node_modules/A/index.d.ts": "export {};",
    };
    let runtimeFiles: Record<string, string> = {
      "/node_modules/A/index.js": "module.exports = {};",
    };
    let resets = 0;
    const clearDependencyGraph = (): void => {
      installedPackages = new Map();
      dependencyRoots = new Set();
      editorLibs = {};
      runtimeFiles = {};
    };
    const staleInstall = lifecycle.mutateWorkerIfCurrent(
      installGeneration,
      () => sourceVersion === installVersion,
      async () => {
        installStarted();
        await installBlocked;
        workerFiles.add("B/compiler.d.ts");
      },
      async () => {
        resets++;
        workerFiles = new Set();
      },
      clearDependencyGraph,
    );
    await installDidStart;
    sourceVersion++;
    releaseInstall();
    assert.equal(await staleInstall, false);
    assert.equal(resets, 1);
    assert.deepEqual([...workerFiles], []);
    assert.deepEqual([...installedPackages], []);
    assert.deepEqual([...dependencyRoots], []);
    assert.deepEqual(editorLibs, {});
    assert.deepEqual(runtimeFiles, {});

    const currentInstall = await lifecycle.mutateWorkerIfCurrent(
      installGeneration,
      () => true,
      async () => {
        workerFiles.add("current/compiler.d.ts");
      },
      async () => {
        resets++;
        workerFiles = new Set();
      },
      clearDependencyGraph,
    );
    assert.equal(currentInstall, true);
    assert.deepEqual([...workerFiles], ["current/compiler.d.ts"]);
    assert.equal(resets, 1);
  };
