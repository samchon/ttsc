import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";

/**
 * Verifies a rejected project-input watch root is reported and retryable.
 *
 * An in-project declaration is intentionally hoisted to the project root.
 * Escalating above that root after `fs.watch` fails would install a recursive
 * handle over a shared parent and swallow the valid project watcher, so the
 * recovery pass must leave the lane uncovered. That loss must be explicit, but
 * the failed root must not remain rejected for the rest of the session.
 *
 * 1. Reject the first project-root watcher with `EMFILE`.
 * 2. Prove the ordinary watch error and the distinct uncovered-lane report.
 * 3. Let the recovery microtask honor the project-root ceiling.
 * 4. Republish the unchanged snapshot and prove it retries successfully.
 * 5. Reject a replacement root and keep reporting the old live handle.
 *
 * @evidence contracts/testing.md#behavioral-verification First-root EMFILE is explicit and retryable; recovery cannot escape the project ceiling, replacement failure preserves the live handle and changed snapshots retain separate ownership.
 * @evidence contracts/testing.md#independent-expectations Independently supplied EMFILE failures, exact active/unavailable root sets and handle close counts establish resource and recovery expectations.
 * @evidence contracts/testing.md#distinguishing-cases First-root EMFILE is explicit and retryable; recovery cannot escape the project ceiling, replacement failure preserves the live handle and changed snapshots retain separate ownership; uncontrolled native scheduling remains covered by the retained actual fs.watch watch boundaries.
 * @evidence contracts/testing.md#execution-ownership The named src/features/watch function directly calls authored WatchTopology project-input publication and recovery operations through explicit supplied observer callbacks; no refresh/listFilesOnly, product host, native build or installed consumer is executed.
 */
export async function test_watch_topology_retries_rejected_project_input_roots() {
    const root = TestProject.tmpdir("ttsc-project-input-retry-");
    const input = path.join(root, "api", "schema.json");
    const errors: Array<{ error: unknown; location: string }> = [];
    const unavailable: string[][] = [];
    let attempts = 0;
    let activeRoots: readonly string[] = [];

    const openFileWatch = (() => {
        attempts += 1;
        if (attempts === 1) {
          const error = new Error("descriptor limit") as NodeJS.ErrnoException;
          error.code = "EMFILE";
          throw error;
        }
        return new FakeWatcher() as unknown as fs.FSWatcher;
      }) as typeof fs.watch;

    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
      },
      {
        onError: (location, error) => errors.push({ error, location }),
        onInputChange: () => {
          throw new Error("watch setup must not report an input change");
        },
        onProjectInputWatchUnavailable: (roots) => {
          unavailable.push([...roots]);
        },
        onProjectInputWatchRoots: (roots) => {
          activeRoots = [...roots];
        },
        onTopologyChange: () => {
          throw new Error("watch setup must not report a topology change");
        },
      },
      // Every directory watch goes through the explicitly supplied subscription operation.
      (location, recursive, listener) => watchDirectoryThroughFsWatch(location, recursive, listener, openFileWatch),
    openFileWatch,
    );
    const snapshot = {
      files: [input],
      globs: [],
      root,
    };

    try {
      topology.setProjectInputs(snapshot);
      await Promise.resolve();

      assert.equal(attempts, 1, "recovery must not spin on a rejected root");
      assert.equal(errors.length, 1);
      assert.equal((errors[0]?.error as NodeJS.ErrnoException).code, "EMFILE");
      assert.equal(realpath(errors[0]!.location), realpath(root));
      assert.deepEqual(unavailable, [[realpath(root)]]);
      assert.deepEqual(activeRoots, []);

      topology.setProjectInputs(snapshot);
      assert.equal(attempts, 2, "unchanged snapshot did not retry failed root");
      assert.deepEqual(activeRoots, [realpath(root)]);
      assert.deepEqual(
        unavailable,
        [[realpath(root)]],
        "recovery should not repeat an already reported dark-lane warning",
      );
    } finally {
      topology.close();

    }

    await verifyFallbackChain();
    await verifyCloseDuringFailure();
    await verifyLiveRootReportingSurvivesFailedReplacement();
}

async function verifyFallbackChain(): Promise<void> {
  const projectRoot = TestProject.tmpdir("ttsc-project-input-project-");
  const externalRoot = TestProject.tmpdir("ttsc-project-input-fallback-");
  const firstFallback = path.join(externalRoot, "a");
  const requested = path.join(firstFallback, "b");
  const input = path.join(requested, "missing", "schema.json");
  fs.mkdirSync(requested, { recursive: true });
  const attempts: string[] = [];
  const errors: string[] = [];
  const unavailable: string[][] = [];
  let activeRoots: readonly string[] = [];
  const openFileWatch = ((location: fs.PathLike) => {
      const resolved = path.resolve(location.toString());
      attempts.push(resolved);
      if (attempts.length <= 2) {
        throw new Error(`reject ${resolved}`);
      }
      return new FakeWatcher() as unknown as fs.FSWatcher;
    }) as typeof fs.watch;

  const topology = new WatchTopology(
    {
      cwd: projectRoot,
      files: [],
      projectRoot,
      tsconfig: path.join(projectRoot, "tsconfig.json"),
    },
    {
      onError: (location) => errors.push(path.resolve(location)),
      onInputChange: () => {
        throw new Error("watch setup must not report an input change");
      },
      onProjectInputWatchUnavailable: (roots) => {
        unavailable.push([...roots]);
      },
      onProjectInputWatchRoots: (roots) => {
        activeRoots = [...roots];
      },
      onTopologyChange: () => {
        throw new Error("watch setup must not report a topology change");
      },
    },
    (location, recursive, listener) => watchDirectoryThroughFsWatch(location, recursive, listener, openFileWatch),
    openFileWatch,
  );
  try {
    topology.setProjectInputs({
      files: [input],
      globs: [],
      root: projectRoot,
    });
    await Promise.resolve();

    assert.deepEqual(
      attempts.map(realpath),
      [requested, firstFallback, externalRoot].map(realpath),
      "recovery did not exhaust the finite safe-ancestor chain",
    );
    assert.deepEqual(
      errors.map(realpath),
      [requested, firstFallback].map(realpath),
    );
    assert.equal(activeRoots.length, 1);
    assert.equal(realpath(activeRoots[0]!), realpath(externalRoot));
    assert.deepEqual(
      unavailable,
      [],
      "a successful safe fallback must not report a transient observation loss",
    );
  } finally {
    topology.close();

  }
}

async function verifyCloseDuringFailure(): Promise<void> {
  const projectRoot = TestProject.tmpdir("ttsc-project-input-close-project-");
  const firstRoot = TestProject.tmpdir("ttsc-project-input-close-first-");
  const secondRoot = TestProject.tmpdir("ttsc-project-input-close-second-");
  const created: FakeWatcher[] = [];
  let attempts = 0;

  const openFileWatch = (() => {
      attempts += 1;
      if (attempts === 1) throw new Error("close during watch failure");
      const watcher = new FakeWatcher();
      created.push(watcher);
      return watcher as unknown as fs.FSWatcher;
    }) as typeof fs.watch;

  let topology: WatchTopology;
  topology = new WatchTopology(
    {
      cwd: projectRoot,
      files: [],
      projectRoot,
      tsconfig: path.join(projectRoot, "tsconfig.json"),
    },
    {
      onError: () => topology.close(),
      onInputChange: () => {
        throw new Error("watch setup must not report an input change");
      },
      onTopologyChange: () => {
        throw new Error("watch setup must not report a topology change");
      },
    },
    (location, recursive, listener) => watchDirectoryThroughFsWatch(location, recursive, listener, openFileWatch),
    openFileWatch,
  );
  try {
    topology.setProjectInputs({
      files: [
        path.join(firstRoot, "first.json"),
        path.join(secondRoot, "second.json"),
      ],
      globs: [],
      root: projectRoot,
    });
    await Promise.resolve();

    assert.equal(attempts, 1, "close() did not stop the in-flight sync pass");
    assert.deepEqual(created, [], "a watcher was installed after close()");
  } finally {
    topology.close();

  }
}

async function verifyLiveRootReportingSurvivesFailedReplacement(): Promise<void> {
  const projectRoot = TestProject.tmpdir("ttsc-project-input-report-project-");
  const firstRoot = TestProject.tmpdir("ttsc-project-input-report-first-");
  const secondRoot = TestProject.tmpdir("ttsc-project-input-report-second-");
  const errors: string[] = [];
  let activeRoots: readonly string[] = [];
  let attempts = 0;
  const openFileWatch = ((location: fs.PathLike) => {
      attempts += 1;
      if (attempts === 2) throw new Error("reject replacement");
      return new FakeWatcher() as unknown as fs.FSWatcher;
    }) as typeof fs.watch;

  const topology = new WatchTopology(
    {
      cwd: projectRoot,
      files: [],
      projectRoot,
      tsconfig: path.join(projectRoot, "tsconfig.json"),
    },
    {
      onError: (location) => errors.push(path.resolve(location)),
      onInputChange: () => {
        throw new Error("watch setup must not report an input change");
      },
      onProjectInputWatchRoots: (roots) => {
        activeRoots = [...roots];
      },
      onTopologyChange: () => {
        throw new Error("watch setup must not report a topology change");
      },
    },
    (location, recursive, listener) => watchDirectoryThroughFsWatch(location, recursive, listener, openFileWatch),
    openFileWatch,
  );
  try {
    topology.setProjectInputs({
      files: [path.join(firstRoot, "first.json")],
      globs: [],
      root: projectRoot,
    });
    assert.deepEqual(activeRoots, [realpath(firstRoot)]);

    topology.setProjectInputs({
      files: [path.join(secondRoot, "second.json")],
      globs: [],
      root: projectRoot,
    });
    assert.deepEqual(errors.map(realpath), [realpath(secondRoot)]);
    assert.deepEqual(
      activeRoots,
      [realpath(firstRoot)],
      "a failed replacement must not hide its still-live predecessor",
    );
  } finally {
    topology.close();

  }
  await Promise.resolve();
}

class FakeWatcher {
  public closeCount = 0;

  public close(): void {
    this.closeCount += 1;
  }

  public on(_event: "error", _listener: (error: Error) => void): FakeWatcher {
    return this;
  }
}

function realpath(location: string): string {
  return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
}
