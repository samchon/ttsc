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
 * Verifies plugin corpus: source plugin bootstraps a Program and Checker
 * against the consumer tsconfig.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_source_plugin_bootstraps_a_program_and_checker_against_the_consumer_tsconfig =
  () => {
    const root = copyProject("go-source-plugin-checker");
    const cacheDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-source-plugin-checker-"),
    );
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: cacheDir,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stderr,
      /building source plugin "go-source-plugin-checker"/,
    );
    const out = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(out, /"User"/);
    assert.match(out, /"string\[\]"/);
  };
