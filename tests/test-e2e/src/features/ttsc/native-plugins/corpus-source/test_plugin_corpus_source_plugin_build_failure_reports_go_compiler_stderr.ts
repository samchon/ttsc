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
 * The CLI must preserve native build-failure context together with the
 * independent TypeScript error. These assertions do not pin the raw Go syntax
 * error text or an exact nonzero exit code.
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
 * @evidence contracts/e2e.md#shared-execution The copied invalid source and initially empty private cache preserve actual cold preparation failure; a canonical warm binary cannot replace this input. Suite compiler and Go toolchain preparation are available for reuse, without counting all preparations or claiming minimum process cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject tracks the consumer and private cache. The syntax mutation must change the copied bytes before launch. Child-specific PATH/cache options leave ambient state unchanged; launch error, signal and numeric nonzero status are distinguished from the intentional product failure. The synchronous result does not certify arbitrary descendants or loaded-image equality.
 * @evidence contracts/e2e.md#preserved-coverage ttsc --emit with broken Go source and a TS assignment error fails and preserves both build-failure context and TS2322. These assertions stay in test_plugin_corpus_source_plugin_build_failure_reports_go_compiler_stderr with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_source_plugin_build_failure_reports_go_compiler_stderr =
  () => {
    const root = copyProject("go-source-plugin");
    // Inject a syntax error into the Go source.
    const goFile = path.join(root, "go-plugin", "main.go");
    const original = fs.readFileSync(goFile, "utf8");
    const broken = original.replace(
      "package main",
      "package main\nthis is not valid go;",
    );
    assert.notEqual(broken, original, "expected to inject the Go syntax error");
    fs.writeFileSync(goFile, broken);
    fs.appendFileSync(
      path.join(root, "src", "main.ts"),
      '\nconst wrong: number = "type-error";\nvoid wrong;\n',
      "utf8",
    );
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-broken-");
    assert.deepEqual(fs.readdirSync(cacheDir), []);
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: cacheDir,
      },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(typeof result.status, "number");
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /building plugin "go-source-plugin" via "go build" failed/,
    );
    assert.match(result.stderr, /TS2322/);
  };
