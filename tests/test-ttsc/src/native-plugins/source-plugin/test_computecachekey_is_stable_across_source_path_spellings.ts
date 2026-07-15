import { TestProject } from "@ttsc/testing";

import { assert, computeCacheKey, fs, path } from "../../internal/source-build";

/**
 * Verifies computeCacheKey is stable across source path spellings.
 *
 * The plugin cache key must identify a source by its CONTENT, not by the exact
 * path string a caller happens to reach it through. `computeCacheKey` hashes
 * file bytes plus separator-normalized RELATIVE paths and the normalized
 * `entry`, never the absolute directory string, so the same directory reached
 * via a trailing separator, forward-slash separators, or a redundant `.`/`..`
 * segment must produce ONE key — a single source can never split into two cache
 * entries (issue #625, which suspected — incorrectly — a per-spelling key
 * split).
 *
 * 1. Materialize a Go plugin package with a nested source file.
 * 2. Compute the key for its directory spelled four equivalent ways.
 * 3. Assert every spelling yields the canonical key.
 */
export const test_computecachekey_is_stable_across_source_path_spellings =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
    const plugin = path.join(root, "plugin");
    fs.mkdirSync(path.join(plugin, "sub"), { recursive: true });
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
    // A nested file so the key covers a relative path that carries a separator.
    fs.writeFileSync(
      path.join(plugin, "sub", "helper.go"),
      "package sub\n\nconst Value = 1\n",
      "utf8",
    );

    const keyFor = (dir: string) =>
      computeCacheKey({
        dir,
        entry: ".",
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
      path.join(plugin, "nested", ".."),
      path.join(path.dirname(plugin), ".", path.basename(plugin)),
    ];
    for (const spelling of spellings) {
      assert.equal(
        keyFor(spelling),
        canonical,
        `path spelling ${JSON.stringify(spelling)} produced a different key`,
      );
    }
  };
