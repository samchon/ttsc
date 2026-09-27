import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { acquireDependencyBuildLock } from "../../internal/dependency-cache";
import { acquirePluginBuildLock } from "../../internal/source-build";

/**
 * Verifies both build locks report a candidate rename that lost the race for
 * `current` as not acquired, whatever the destination looks like afterwards.
 *
 * On Windows a rename onto a directory another process holds, or is deleting,
 * fails with `EPERM`. Each lock took that as a lost race only when `current`
 * still existed at the moment it looked. A holder that released in between left
 * nothing there, so the lost race was thrown as a permission failure and the
 * build failed (samchon/ttsc#1582). The candidate was just created in the same
 * directory, so the directory is writable and the error alone decides.
 *
 * 1. Make each lock's rename onto `current` fail with `EPERM` while no `current`
 *    exists, as a release between the rename and the look leaves it.
 * 2. Assert the plugin build lock and the dependency build lock both report the
 *    acquisition as not acquired instead of throwing.
 * 3. Restore `fs.renameSync` and assert each lock is acquired normally.
 */
export const test_build_locks_take_a_contended_candidate_rename_as_a_lost_race =
  (): void => {
    const root = TestProject.tmpdir("ttsc-lock-contended-rename-");
    const pluginLock = path.join(root, "plugin.lock");
    const dependencyLock = path.join(root, "dependency.lock");

    const originalRename = fs.renameSync;
    Object.defineProperty(fs, "renameSync", {
      configurable: true,
      value: ((source: fs.PathLike, destination: fs.PathLike) => {
        if (path.basename(String(destination)) === "current") {
          throw Object.assign(
            new Error(
              `EPERM: operation not permitted, rename '${String(source)}' -> '${String(destination)}'`,
            ),
            { code: "EPERM", syscall: "rename" },
          );
        }
        originalRename(source, destination);
      }) as typeof fs.renameSync,
      writable: true,
    });
    try {
      assert.equal(acquirePluginBuildLock(pluginLock), null);
      assert.equal(acquireDependencyBuildLock(dependencyLock), null);
    } finally {
      Object.defineProperty(fs, "renameSync", {
        configurable: true,
        value: originalRename,
        writable: true,
      });
    }

    assert.notEqual(acquirePluginBuildLock(pluginLock), null);
    assert.notEqual(acquireDependencyBuildLock(dependencyLock), null);
  };
