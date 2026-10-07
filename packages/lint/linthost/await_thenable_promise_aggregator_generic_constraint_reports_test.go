package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenablePromiseAggregatorGenericConstraintReports verifies the
// element extractor follows a generic argument's Iterable constraint before
// deciding whether its members are awaitable.
//
//  1. Constrain a generic input to Iterable<number>.
//  2. Pass it to native Promise.all.
//  3. Assert the constrained argument produces one finding.
//
// @evidence contracts/testing.md#behavioral-verification An aggregator argument constrained to scalar Iterable<number> must report.
// @evidence contracts/testing.md#independent-expectations The authored T extends Iterable<number> argument independently requires one rule-labelled error on line 2, code 2 and empty stdout. Label counting rejects extras, and the rendered-main.ts helper checks line 2 and error severity; exact columns, message text and unrelated diagnostics are outside these assertions.
// @evidence contracts/testing.md#distinguishing-cases AwaitableInputsAllow includes an unconstrained generic iterable; the concrete scalar constraint distinguishes this positive.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenablePromiseAggregatorGenericConstraintReports invokes the in-process check command with a real Program/Checker in the shared Go unit population; original source/configuration and all assertions remain, with no child compiler, installed consumer or native artifact build.
func TestAwaitThenablePromiseAggregatorGenericConstraintReports(t *testing.T) {
  root := seedLintProject(t, `function aggregate<T extends Iterable<number>>(values: T): void {
  void Promise.all(values);
}
void aggregate;
`)
  seedLintRules(t, root, map[string]string{"typescript/await-thenable": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" {
    t.Fatalf("generic Promise aggregator run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 1 {
    t.Fatalf("expected 1 await-thenable finding, got %d:\n%s", got, stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:2:") {
    t.Fatalf("generic constrained argument was not reported:\n%s", stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr, 2)
}
