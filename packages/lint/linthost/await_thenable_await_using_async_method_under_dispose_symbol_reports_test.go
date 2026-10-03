package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitUsingAsyncMethodUnderDisposeSymbolReports verifies an
// `async [Symbol.dispose]()` method does not pass for the async-dispose
// protocol.
//
// The async modifier does not change the method's well-known symbol: this
// resource still has Symbol.dispose rather than Symbol.asyncDispose. The source
// differs from the async-disposable clean fixture at that protocol key, and
// requires one rule error on the initializer's declaration line.
//
//  1. Seed a project declaring `await using` over an object whose only
//     member is `async [Symbol.dispose]()`.
//  2. Prove the fixture type-checks without a lint plugin entry.
//  3. Run `check` with typescript/await-thenable enabled as error.
//  4. Assert exactly one finding on the declaration line.
//
// @evidence contracts/testing.md#behavioral-verification An async method under the synchronous dispose symbol must not impersonate async-dispose.
// @evidence contracts/testing.md#independent-expectations The authored async method under Symbol.dispose independently requires one rule-labelled error on line 3, code 2 and empty stdout. Label counting rejects extras, and the rendered-main.ts helper checks line 3 and error severity; exact columns and unrelated diagnostics are outside these assertions.
// @evidence contracts/testing.md#distinguishing-cases Symbol spelling, rather than method async modifier, separates this source from AsyncDisposableAllows.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenableAwaitUsingAsyncMethodUnderDisposeSymbolReports executes the in-process check command with a real Program/Checker; the original separate no-plugin compiler-prerequisite check is retained before rule execution in the shared Go unit process. Fixture configuration is input; no child compiler, native build or installed consumer runs.
func TestAwaitThenableAwaitUsingAsyncMethodUnderDisposeSymbolReports(t *testing.T) {
  root := seedAwaitUsingLintProject(t, `export {};
async function main(): Promise<void> {
  await using resource = {
    async [Symbol.dispose](): Promise<void> {},
  };
  JSON.stringify(resource);
}
void main();
`)
  assertAwaitUsingProjectTypeChecks(t, root)
  seedLintRules(t, root, map[string]string{"typescript/await-thenable": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" {
    t.Fatalf("async-method-under-dispose run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 1 {
    t.Fatalf("expected 1 await-thenable finding, got %d:\n%s", got, stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:3:") {
    t.Fatalf("finding not anchored on the declaration line:\n%s", stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr, 3)
}
