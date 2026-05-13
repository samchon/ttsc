import {
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttsxBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: ttsx relative cache dir builds source plugin under
 * cwd option.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_ttsx_relative_cache_dir_builds_source_plugin_under_cwd_option =
  () => {
    const root = copyProject("go-source-plugin");
    const driverCwd = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-driver-"));
    const cacheDir = ".ttsx-cache";

    const result = spawn(
      ttsxBin,
      ["--cwd", root, "--cache-dir", cacheDir, "src/main.ts"],
      {
        cwd: driverCwd,
        env: { PATH: goPath() },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "PLUGIN");
    assert.equal(fs.existsSync(path.join(root, cacheDir, "project")), true);
    assert.equal(fs.existsSync(path.join(root, cacheDir, "plugins")), true);
    assert.equal(
      fs.existsSync(path.join(driverCwd, cacheDir, "project")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(driverCwd, cacheDir, "plugins")),
      false,
    );
  };
