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
 * Verifies plugin corpus: source plugin build failure reports Go compiler
 * stderr.
 *
 * When `go build` fails the raw compiler output must flow through to ttsc's
 * stderr so authors can debug syntax errors without running Go separately. A
 * silent failure would leave users with only a non-zero exit code and no
 * actionable information.
 *
 * 1. Copy the fixture, inject a Go syntax error, and add a TS2322 source error.
 * 2. Run ttsc with `--emit`.
 * 3. Assert both the plugin build failure and TS2322 remain visible.
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
    fs.appendFileSync(
      path.join(root, "src", "main.ts"),
      '\nconst wrong: number = "type-error";\nvoid wrong;\n',
      "utf8",
    );
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-source-plugin-broken-"),
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /building plugin "go-source-plugin" via "go build" failed/,
    );
    assert.match(result.stderr, /TS2322/);
  };
