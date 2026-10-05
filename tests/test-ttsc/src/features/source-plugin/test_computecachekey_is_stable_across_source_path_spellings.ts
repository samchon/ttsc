import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { computeCacheKey } from "../../../../../packages/ttsc/src/plugin/internal/source/computeCacheKey";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies computeCacheKey is stable across source path spellings.
 *
 * The plugin cache key must identify a source by its CONTENT, not by the exact
 * path string a caller happens to reach it through. `computeCacheKey` hashes
 * file bytes plus separator-normalized RELATIVE paths with a fixed `entry`,
 * rather than the absolute directory string, so the same directory reached via
 * a trailing separator, forward-slash separators, or a redundant `.`/`..`
 * segment must produce ONE key — a single source can never split into two cache
 * entries (issue #625, which suspected — incorrectly — a per-spelling key
 * split).
 *
 * 1. Materialize a Go plugin package with a nested source file.
 * 2. Compute the key for its directory spelled four equivalent ways.
 * 3. Assert every spelling yields the canonical key.
 *
 * @evidence contracts/testing.md#behavioral-verification computeCacheKey equals the canonical key for trailing separator, forward slash, redundant parent and dot source spellings.
 * @evidence contracts/testing.md#independent-expectations Each spelling resolves to the same nested-source fixture; the oracle is required equivalence rather than a digest generated as a expected snapshot.
 * @evidence contracts/testing.md#distinguishing-cases Equivalent native path spellings must share identity; POSIX-invalid backslash spelling is deliberately not included.
 * @evidence contracts/testing.md#execution-ownership A unit test calling computeCacheKey directly on a temp Go module with no goBinary and no go.mod replace directive, so no Go process is spawned and no native build or consumer host is involved.
 */
export const test_computecachekey_is_stable_across_source_path_spellings =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
    const plugin = path.join(root, "plugin");
    TestProject.copyDirectory(
      path.join(
        TestProject.WORKSPACE_ROOT,
        "packages",
        "ttsc",
        "test",
        "fixtures",
        "unit",
        "computecachekey_is_stable_across_source_path_spellings",
        "inputs-1",
      ),
      root,
    );
    for (const relative of ["main.go", "sub/helper.go"])
      fs.renameSync(
        path.join(plugin, `${relative}.txt`),
        path.join(plugin, relative),
      );
    assert.equal(
      fs.readFileSync(path.join(plugin, "go.mod"), "utf8"),
      "module example.com/plugin\n\ngo 1.26\n",
    );
    assert.equal(
      fs.readFileSync(path.join(plugin, "main.go"), "utf8"),
      "package main\n",
    );
    assert.equal(
      fs.readFileSync(path.join(plugin, "sub", "helper.go"), "utf8"),
      "package sub\n\nconst Value = 1\n",
    );
    fs.mkdirSync(path.join(plugin, "nested"));

    const keyFor = (dir: string) =>
      computeCacheKey({
        dir,
        entry: ".",
        env: {},
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

    const canonical = keyFor(plugin);
    // Every spelling below resolves to the SAME directory on both Windows and
    // POSIX (forward slashes are accepted on Windows; backslashes are not on
    // POSIX, so a backslash spelling is deliberately excluded).
    const spellings = [
      plugin + path.sep,
      plugin.replace(/\\/g, "/"),
      `${plugin}${path.sep}nested${path.sep}..`,
      `${path.dirname(plugin)}${path.sep}.${path.sep}${path.basename(plugin)}`,
    ];
    for (const spelling of spellings) {
      assert.equal(
        keyFor(spelling),
        canonical,
        `path spelling ${JSON.stringify(spelling)} produced a different key`,
      );
    }
  };
