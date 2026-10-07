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
 * in the workspace's `node_modules/.cache/ttsc` rather than either asserted
 * legacy `.ttsc` location. This case does not enumerate every global cache or
 * certify which Go executable bytes ran. Its copied producer and private
 * default cache preserve cold, warm and invalidated publication through the
 * CLI.
 *
 * 1. Copy the `go-source-plugin` fixture and run real ttsc with no cache override.
 * 2. Assert the one content-keyed binary lands under the workspace-local cache.
 * 3. Assert no legacy `.ttsc` directories were created.
 *
 * @evidence contracts/testing.md#behavioral-verification CLI success with blocked system-Go PATH, cold-build diagnostic, exactly one native binary and absent legacy paths verify actual default publication; unchanged source must reuse without a build log, while editing the uppercase branch must rebuild and emit bracketed output.
 * @evidence contracts/testing.md#independent-expectations Explicit empty installation marks the expected workspace; native filename and filesystem existence establish publication, and original PLUGIN/[PLUGIN] literals and build-log polarity independently prescribe warm reuse versus actual source invalidation.
 * @evidence contracts/testing.md#distinguishing-cases Owns default cache placement with empty override, one cold entry, absent legacy locations and warm versus changed-source outputs. Blocked PATH and empty Go override remain original inputs, but success alone cannot distinguish bundled Go from another supported fallback such as a home SDK.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named corpus-source export in the generic E2E population; its body owns the cold, warm and changed-source CLI sequence. Body presence is not actual execution or a Linux-only selection claim.
 * @evidence contracts/e2e.md#necessary-boundary A path-selection unit cannot observe native compilation and binary publication at the selected installation root.
 * @evidence contracts/e2e.md#shared-execution One copied producer and private default cache preserve placement, cold build-log polarity, unchanged-source output and changed-source publication. Go object cache is shared without prewarming this initially absent plugin cache. These observations do not count all actual builds/processes, independently certify a cache hit or prove minimum preparation cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The initially empty explicit installation anchors the expected workspace; plugin cache and emitted main start absent. Source mutations stay in the tracked copied consumer. Each synchronous result checks error, signal and status before the next mutation; the warm output is removed before requesting its replacement. Arbitrary descendants, selected Go bytes and loaded-image equality are not certified.
 * @evidence contracts/e2e.md#preserved-coverage Original build diagnostic, one-entry native binary, both legacy-absence assertions, cold/warm success and PLUGIN, warm build-log absence, changed-source inequality/rebuild/bracketed output and two entries remain. Original blocked PATH/empty Go override inputs remain, with the unsupported inference of independently proved bundled executable identity withdrawn rather than the inputs or future actual identity-observation obligation.
 */
export function test_plugin_corpus_source_plugin_default_cache_is_workspace_local_content_cache(): void {
  const root = copyProject("go-source-plugin");
  // An empty install root is actual workspace-placement evidence; do not let
  // an unrelated ancestor installation select this fixture's default cache.
  fs.mkdirSync(path.join(root, "node_modules"));
  assert.deepEqual(fs.readdirSync(path.join(root, "node_modules")), []);
  const pluginCache = path.join(
    root,
    "node_modules",
    ".cache",
    "ttsc",
    "plugins",
  );
  assert.equal(fs.existsSync(pluginCache), false);
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);

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
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /building source plugin "go-source-plugin"/);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"PLUGIN"/,
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
  assert.equal(fs.existsSync(path.join(root, "node_modules", ".ttsc")), false);
  assert.equal(fs.existsSync(path.join(root, ".ttsc")), false);
  fs.unlinkSync(path.join(root, "dist", "main.js"));
  const warm = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
  assert.equal(warm.error, undefined);
  assert.equal(warm.signal, null);
  assert.equal(warm.status, 0, warm.stderr);
  assert.doesNotMatch(warm.stderr, /building source plugin/);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"PLUGIN"/,
  );

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
  assert.equal(second.error, undefined);
  assert.equal(second.signal, null);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stderr, /building source plugin/);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"\[PLUGIN\]"/,
  );
  assert.equal(
    pluginCacheEntryDirs(pluginCache).length,
    2,
    "source mutation must publish a second content identity",
  );
}
