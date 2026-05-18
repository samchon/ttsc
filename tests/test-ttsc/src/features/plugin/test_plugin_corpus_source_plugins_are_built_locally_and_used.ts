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
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
