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
} from "../../../../internal/ttsc/internal/plugin-corpus";

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
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc --emit with broken Go source and a TS assignment error fails and preserves both build-failure context and TS2322.
 * @evidence contracts/testing.md#independent-expectations The injected invalid Go text cannot compile and the string-to-number assignment requires TS2322.
 * @evidence contracts/testing.md#distinguishing-cases Native preparation fails before host execution while an independent project error remains visible; the current assertions do not pin the exact raw Go syntax-error text.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_source_plugin_build_failure_reports_go_compiler_stderr entry is discovered by TestExecutor from corpus-source in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The CLI launches the actual Go compiler against invalid plugin source, reports its build failure, then retains an independent TypeScript project error. In-process syntax/rule checks cannot prove both producer failure and compiler diagnostics survive launcher failure handling.
 * @evidence contracts/e2e.md#shared-execution A copied consumer/plugin fixture and private cold plugin cache retain this case's entry selection, build log or failure. The suite built compiler and Go toolchain are reused; the source mutation or forbidden replacement cannot reuse the canonical warm producer binary.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsc --emit with broken Go source and a TS assignment error fails and preserves both build-failure context and TS2322. These assertions stay in test_plugin_corpus_source_plugin_build_failure_reports_go_compiler_stderr with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
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
