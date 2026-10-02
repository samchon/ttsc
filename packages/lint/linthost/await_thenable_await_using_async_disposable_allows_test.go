package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitUsingAsyncDisposableAllows verifies the `await using`
// arm of typescript/await-thenable stays silent on the four authored resource
// declaration shapes below.
//
// The negative twins of the sync-disposable positive: an object literal with
// a real `[Symbol.asyncDispose]` method, an `any` initializer
// (typescript-eslint's explicit escape hatch), a plain `using` declaration
// over a sync disposable (no `await`, so the arm must not engage), and the
// `for (await using x of ...)` binding form whose declarators carry no
// initializer (upstream skips them). A regression that blanket-bans
// `await using` or keys on the statement instead of each initializer
// surfaces here.
//
//  1. Seed a project containing all four valid resource-management shapes.
//  2. Prove the fixture type-checks without a lint plugin entry.
//  3. Run `check` with typescript/await-thenable enabled as error.
//  4. Assert a clean exit with no await-thenable finding.
//
// @evidence contracts/testing.md#behavioral-verification Supported async disposable resources must not produce await-using findings.
// @evidence contracts/testing.md#independent-expectations The authored four resource declarations independently require code 0, empty stdout and no rule-labelled stderr after a separate no-plugin clean compiler check. The rendered-main.ts helper also requires zero matches; it does not certify unrelated diagnostic anchors.
// @evidence contracts/testing.md#distinguishing-cases Async-dispose, any, sync using and iterated async resources stay clean; SyncDisposableReports and AsyncMethodUnderDisposeSymbolReports provide opposite protocol cases.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenableAwaitUsingAsyncDisposableAllows executes the in-process check command with a real Program/Checker; the original separate no-plugin compiler-prerequisite check is retained before rule execution in the shared Go unit process. Fixture configuration is input; no child compiler, native build or installed consumer runs.
func TestAwaitThenableAwaitUsingAsyncDisposableAllows(t *testing.T) {
  root := seedAwaitUsingLintProject(t, `export {};
interface AsyncResource {
  [Symbol.asyncDispose](): Promise<void>;
}
declare function listResources(): AsyncResource[];
async function main(): Promise<void> {
  await using asyncResource = {
    async [Symbol.asyncDispose](): Promise<void> {},
  };
  await using fromAny = 3 as any;
  using syncResource = {
    [Symbol.dispose](): void {},
  };
  for (await using iterated of listResources()) {
    JSON.stringify(iterated);
  }
  JSON.stringify([asyncResource, fromAny, syncResource]);
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
  if code != 0 || stdout != "" || strings.Contains(stderr, "[typescript/await-thenable]") {
    t.Fatalf("valid resource management was reported: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr)
}
