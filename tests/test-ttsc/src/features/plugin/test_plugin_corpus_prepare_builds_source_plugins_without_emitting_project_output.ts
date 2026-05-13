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
 * Verifies plugin corpus: prepare builds source plugins without emitting
 * project output.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_prepare_builds_source_plugins_without_emitting_project_output =
  () => {
    const root = copyProject("go-source-plugin");
    const cacheDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-source-plugin-prepare-"),
    );
    const env = {
      PATH: goPath(),
      TTSC_CACHE_DIR: cacheDir,
    };

    const prepared = spawn(ttscBin, ["prepare", "--cwd", root], {
      cwd: root,
      env,
    });
    assert.equal(prepared.status, 0, prepared.stderr);
    assert.match(prepared.stdout, /ttsc: prepared /);
    assert.match(prepared.stderr, /building source plugin "go-source-plugin"/);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
    const pluginCache = path.join(cacheDir, "plugins");
    const binaries = fs
      .readdirSync(pluginCache, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) =>
        path.join(
          pluginCache,
          entry.name,
          process.platform === "win32" ? "plugin.exe" : "plugin",
        ),
      );
    assert.equal(binaries.length, 1);
    const binary = binaries[0];
    assert.ok(binary);
    assert.equal(fs.existsSync(binary), true);

    const built = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
    assert.equal(built.status, 0, built.stderr);
    assert.doesNotMatch(built.stderr, /building source plugin/);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );
  };
