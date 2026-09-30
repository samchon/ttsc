import {
  assert,
  copyProject,
  fs,
  goPath,
  path,
  pluginCacheEntryDirs,
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
 *
 * @evidence contracts/testing.md#behavioral-verification CLI success, cold-build diagnostic, exactly one native binary and absent legacy paths verify actual default publication.
 * @evidence contracts/testing.md#independent-expectations Explicit empty installation marks the expected workspace; native filename and filesystem existence independently establish publication.
 * @evidence contracts/testing.md#distinguishing-cases Owns default cache placement without override, one content-keyed entry and absence of both legacy locations.
 * @evidence contracts/testing.md#execution-ownership The matching named native export owns one actual CLI call in the Linux boundary population.
 * @evidence contracts/e2e.md#necessary-boundary A path-selection unit cannot observe native compilation and binary publication at the selected installation root.
 * @evidence contracts/e2e.md#shared-execution Lightweight producer avoids linking the compiler for cache placement; the observed plugin cache remains independently cold.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh explicit installation prevents an unrelated ancestor from selecting the workspace; no warm plugin masks compilation.
 * @evidence contracts/e2e.md#preserved-coverage Original build diagnostic, one-entry, native binary and both legacy-absence assertions remain unchanged.
 */
export function test_plugin_corpus_source_plugin_default_cache_is_workspace_local_content_cache(): void {
    const root = copyProject("go-source-plugin");
    // An empty install root is actual workspace-placement evidence; do not let
    // an unrelated ancestor installation select this fixture's default cache.
    fs.mkdirSync(path.join(root, "node_modules"));

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
    const entries = pluginCacheEntryDirs(pluginCache);
    assert.equal(entries.length, 1);
    const entry = entries[0];
    assert.ok(entry);
    assert.equal(
      fs.existsSync(
        path.join(
          pluginCache,
          entry,
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
  }
