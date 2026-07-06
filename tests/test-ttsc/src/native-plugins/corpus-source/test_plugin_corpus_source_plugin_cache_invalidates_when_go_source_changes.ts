import { TestProject } from "@ttsc/testing";

import {
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: source plugin cache invalidates when Go source
 * changes.
 *
 * The content-addressed cache key is derived from the Go source files. When any
 * source file changes the hash must differ, causing ttsc to rebuild the plugin
 * binary rather than reusing the stale cached entry. Without invalidation a
 * developer edit would silently produce old output.
 *
 * 1. Copy `go-source-plugin`, run ttsc (cold build) and assert `"PLUGIN"` output.
 * 2. Patch `go-plugin/main.go` to wrap the uppercase result in brackets
 *    (`"[PLUGIN]"`), changing the content hash.
 * 3. Run ttsc again and assert it rebuilds (build log present) and the emitted JS
 *    contains `"[PLUGIN]"`.
 */
export const test_plugin_corpus_source_plugin_cache_invalidates_when_go_source_changes =
  () => {
    const root = copyProject("go-source-plugin");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-invalidate-");
    const env = {
      PATH: goPath(),
      TTSC_CACHE_DIR: cacheDir,
    };

    const first = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stderr, /building source plugin/);
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

    const second = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env,
    });
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stderr, /building source plugin/);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"\[PLUGIN\]"/,
    );
  };
