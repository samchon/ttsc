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
 * Verifies plugin corpus: source plugin build failure reports Go compiler
 * stderr.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_source_plugin_build_failure_reports_go_compiler_stderr =
  () => {
    const root = copyProject("go-source-plugin");
    // Inject a syntax error into the Go source.
    const goFile = path.join(root, "go-plugin", "main.go");
    const original = fs.readFileSync(goFile, "utf8");
    fs.writeFileSync(
      goFile,
      original.replace("package main", "package main\nthis is not valid go;"),
    );
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-source-plugin-broken-"),
        ),
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /building plugin "go-source-plugin" via "go build" failed/,
    );
  };
