import {
  assert,
  copyProject,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: source plugin default cache is workspace-local
 * content cache.
 *
 * With no cache override, ttsc must store the content-addressed plugin binary
 * in the workspace's `node_modules/.cache/ttsc` (shared across the monorepo,
 * and reclaimed by `rm -rf node_modules`) — never a global user cache and never
 * a package-local `.ttsc`. Uses the lightweight `go-source-plugin` fixture:
 * this default-cache case cannot share the suite cache, so a cheap plugin keeps
 * it fast. Pins the default placement end-to-end through the real CLI.
 *
 * 1. Copy the `go-source-plugin` fixture and run real ttsc with no cache override.
 * 2. Assert the one content-keyed binary lands under the workspace-local cache.
 * 3. Assert no legacy `.ttsc` directories were created.
 */
export const test_plugin_corpus_source_plugin_default_cache_is_workspace_local_content_cache =
  () => {
    const root = copyProject("go-source-plugin");

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath() },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /building source plugin "go-source-plugin"/);

    const pluginCache = path.join(
      root,
      "node_modules",
      ".cache",
      "ttsc",
      "plugins",
    );
    const entries = fs
      .readdirSync(pluginCache, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && !entry.name.startsWith("scratch-"),
      );
    assert.equal(entries.length, 1);
    const entry = entries[0];
    assert.ok(entry);
    assert.equal(
      fs.existsSync(
        path.join(
          pluginCache,
          entry.name,
          process.platform === "win32" ? "plugin.exe" : "plugin",
        ),
      ),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(root, "node_modules", ".ttsc")),
      false,
    );
    assert.equal(fs.existsSync(path.join(root, ".ttsc")), false);
  };
