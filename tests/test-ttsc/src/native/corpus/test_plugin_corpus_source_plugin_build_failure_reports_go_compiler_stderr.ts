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
 * 1. Copy the `go-source-plugin` fixture and inject a Go syntax error into
 *    `go-plugin/main.go`.
 * 2. Run ttsc with `--emit`.
 * 3. Assert non-zero exit and a message containing `building plugin
 *    "go-source-plugin" via "go build" failed` in stderr.
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
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-source-plugin-broken-"),
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /building plugin "go-source-plugin" via "go build" failed/,
    );
  };
