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
 * Verifies plugin corpus: source plugins are built locally and used.
 *
 * This is the primary happy-path test for the source-plugin build+cache cycle.
 * A cold build must compile the Go source, produce a cached binary, and emit
 * transformed JS. A subsequent warm build must reuse the cache (no build log)
 * and produce identical output, confirming the content-addressed key is stable
 * across repeated invocations.
 *
 * 1. Copy `go-source-plugin` and run ttsc (cold); assert build log and `"PLUGIN"`
 *    in emitted JS.
 * 2. Run ttsc again against the same cache (warm); assert no build log and
 *    `"PLUGIN"` still present.
 */
export const test_plugin_corpus_source_plugins_are_built_locally_and_used =
  () => {
    const root = copyProject("go-source-plugin");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-cache-");
    const env = {
      PATH: goPath(),
      TTSC_CACHE_DIR: cacheDir,
    };

    const cold = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
    assert.equal(cold.status, 0, cold.stderr);
    assert.match(cold.stderr, /building source plugin "go-source-plugin"/);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );

    const warm = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
    assert.equal(warm.status, 0, warm.stderr);
    assert.doesNotMatch(warm.stderr, /building source plugin/);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );
  };
