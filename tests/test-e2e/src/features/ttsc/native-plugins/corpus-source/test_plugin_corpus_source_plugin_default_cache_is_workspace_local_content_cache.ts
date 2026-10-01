import { SHARED_GO_BUILD_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  copyProject,
  fs,
  goPath,
  path,
  pluginCacheEntryDirs,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

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
 * @evidence contracts/testing.md#behavioral-verification CLI success with blocked system-Go PATH, cold-build diagnostic, exactly one native binary and absent legacy paths verify actual default publication; unchanged source must reuse without a build log, while editing the uppercase branch must rebuild and emit bracketed output.
 * @evidence contracts/testing.md#independent-expectations Explicit empty installation marks the expected workspace; native filename and filesystem existence establish publication, and original PLUGIN/[PLUGIN] literals and build-log polarity independently prescribe warm reuse versus actual source invalidation.
 * @evidence contracts/testing.md#distinguishing-cases Owns default cache placement with empty override, one cold entry, absent legacy locations, warm reuse versus source mutation and blocked system-Go PATH versus bundled compilation.
 * @evidence contracts/testing.md#execution-ownership The matching named native export owns the actual cold, warm and changed-source CLI sequence in the Linux boundary population.
 * @evidence contracts/e2e.md#necessary-boundary A path-selection unit cannot observe native compilation and binary publication at the selected installation root.
 * @evidence contracts/e2e.md#shared-execution One lightweight producer and private workspace default cache own placement, bundled-toolchain cold compilation, warm reuse and changed-source recompilation; Go object cache is shared without warming the observed plugin cache.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh explicit installation prevents an unrelated ancestor from selecting the workspace; the observed cache starts empty, original and changed Go source identities remain isolated from workspace source, and TestProject owns consumer/cache cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original build diagnostic, one-entry native binary and both legacy-absence assertions remain; the original local cold/warm success/output and absence of a warm build log, changed-source inequality/rebuild/bracketed output and blocked-PATH bundled success are checked in this sequence.
 */
export function test_plugin_corpus_source_plugin_default_cache_is_workspace_local_content_cache(): void {
    const root = copyProject("go-source-plugin");
    // An empty install root is actual workspace-placement evidence; do not let
    // an unrelated ancestor installation select this fixture's default cache.
    fs.mkdirSync(path.join(root, "node_modules"));

    const env = {
      PATH: "/nonexistent",
      TTSC_CACHE_DIR: "",
      TTSC_GO_BINARY: "",
      TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
    };
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /building source plugin "go-source-plugin"/);
    assert.match(fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"), /"PLUGIN"/);

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
    const warm = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
    assert.equal(warm.status, 0, warm.stderr);
    assert.doesNotMatch(warm.stderr, /building source plugin/);
    assert.match(fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"), /"PLUGIN"/);

    // Edit the actual go-uppercase branch so the hash changes AND the new
    // behavior is observable end-to-end.
    const goFile = path.join(root, "go-plugin", "main.go");
    const original = fs.readFileSync(goFile, "utf8");
    const changed = original.replace(
      /(case "go-uppercase":\n)(\s*)value = strings\.ToUpper\(value\)/,
      `$1$2value = "[" + strings.ToUpper(value) + "]"`,
    );
    assert.notEqual(changed, original, "expected to edit go-uppercase branch");
    fs.writeFileSync(goFile, changed);

    const second = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stderr, /building source plugin/);
    assert.match(fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"), /"\[PLUGIN\]"/);
    assert.equal(pluginCacheEntryDirs(pluginCache).length, 2, "source mutation must publish a second content identity");

  }
