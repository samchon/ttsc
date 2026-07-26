import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

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
 */
export const test_watch_topology_retries_rejected_project_input_roots =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-project-input-retry-");
    const input = path.join(root, "api", "schema.json");
    const originalWatch = fs.watch;
    const errors: Array<{ error: unknown; location: string }> = [];
    const unavailable: string[][] = [];
    let attempts = 0;
    let activeRoots: readonly string[] = [];

    Object.defineProperty(fs, "watch", {
      configurable: true,
      value: (() => {
        attempts += 1;
        if (attempts === 1) {
          const error = new Error("descriptor limit") as NodeJS.ErrnoException;
          error.code = "EMFILE";
          throw error;
        }
        return new FakeWatcher() as fs.FSWatcher;
      }) as typeof fs.watch,
      writable: true,
    });

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
      Object.defineProperty(fs, "watch", {
        configurable: true,
        value: originalWatch,
        writable: true,
      });
    }

    await verifyFallbackChain();
  };

async function verifyFallbackChain(): Promise<void> {
  const projectRoot = TestProject.tmpdir("ttsc-project-input-project-");
  const externalRoot = TestProject.tmpdir("ttsc-project-input-fallback-");
  const firstFallback = path.join(externalRoot, "a");
  const requested = path.join(firstFallback, "b");
  const input = path.join(requested, "missing", "schema.json");
  fs.mkdirSync(requested, { recursive: true });

  const originalWatch = fs.watch;
  const attempts: string[] = [];
  const errors: string[] = [];
  let activeRoots: readonly string[] = [];
  Object.defineProperty(fs, "watch", {
    configurable: true,
    value: ((location: fs.PathLike) => {
      const resolved = path.resolve(location.toString());
      attempts.push(resolved);
      if (attempts.length <= 2) {
        throw new Error(`reject ${resolved}`);
      }
      return new FakeWatcher() as fs.FSWatcher;
    }) as typeof fs.watch,
    writable: true,
  });

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
  } finally {
    topology.close();
    Object.defineProperty(fs, "watch", {
      configurable: true,
      value: originalWatch,
      writable: true,
    });
  }
}

class FakeWatcher {
  public close(): void {}

  public on(_event: "error", _listener: (error: Error) => void): FakeWatcher {
    return this;
  }
}

function realpath(location: string): string {
  return fs.realpathSync.native?.(location) ?? fs.realpathSync(location);
}
