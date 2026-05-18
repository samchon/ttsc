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
 * Verifies plugin corpus: relative cache dir resolves from cwd option.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_relative_cache_dir_resolves_from_cwd_option =
  () => {
    const root = copyProject("go-source-plugin");
    const driverCwd = TestProject.tmpdir("ttsc-driver-");
    const cacheDir = "relative-cache";

    const result = spawn(
      ttscBin,
      ["--cwd", root, "--emit", "--cache-dir", cacheDir],
      {
        cwd: driverCwd,
        env: { PATH: goPath() },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /building source plugin "go-source-plugin"/);
    assert.equal(fs.existsSync(path.join(root, cacheDir, "plugins")), true);
    assert.equal(
      fs.existsSync(path.join(driverCwd, cacheDir, "plugins")),
      false,
    );
  };
