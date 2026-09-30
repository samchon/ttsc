package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenablePromiseAggregatorNativeMethodsReport verifies all four
// native Promise aggregators reject array literals whose only member is
// definitely non-awaitable.
//
//  1. Seed one non-awaitable literal call for all, allSettled, any, and race.
//  2. Run check with typescript/await-thenable enabled as error.
//  3. Assert one finding on the member line of every call.
// @evidence contracts/testing.md#behavioral-verification Every native Promise aggregator must inspect its scalar input elements.
// @evidence contracts/testing.md#independent-expectations The authored source and original assertions fix the complete rule/error line list 1,2,3,4 with code 2 and empty stdout; the added per-rule rendered oracle excludes wrong severity or unrelated diagnostic anchors.
// @evidence contracts/testing.md#distinguishing-cases Original all/allSettled/any/race fixtures report with the upstream message; AwaitableInputsAllow supplies true Promise inputs across methods.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenablePromiseAggregatorNativeMethodsReport invokes the in-process check command with a real Program/Checker in the shared Go unit population; original source/configuration and all assertions remain, with no child compiler, installed consumer or native artifact build.
func TestAwaitThenablePromiseAggregatorNativeMethodsReport(t *testing.T) {
  root := seedLintProject(t, `Promise.all([1]);
Promise.allSettled(["settled"]);
Promise.any([false]);
Promise.race([0n]);
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
    t.Fatalf("native Promise aggregator run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 4 {
    t.Fatalf("expected 4 await-thenable findings, got %d:\n%s", got, stderr)
  }
  if !strings.Contains(stderr, "Unexpected iterable of non-Promise (non-\"Thenable\") values passed to promise aggregator.") {
    t.Fatalf("missing upstream Promise aggregator message:\n%s", stderr)
  }
  for _, anchor := range []string{"main.ts:1:", "main.ts:2:", "main.ts:3:", "main.ts:4:"} {
    if !diagnosticOutputContains(stderr, anchor) {
      t.Fatalf("missing Promise aggregator finding at %s:\n%s", anchor, stderr)
    }
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr, 1, 2, 3, 4)
}
