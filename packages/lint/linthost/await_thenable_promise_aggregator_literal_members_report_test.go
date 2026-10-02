package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenablePromiseAggregatorLiteralMembersReport verifies an array
// literal reports each definitely non-awaitable element instead of collapsing
// the whole argument into one finding.
//
//  1. Mix primitive, Promise, maybe-Promise, hole, and spread members.
//  2. Pass the literal to native Promise.all.
//  3. Assert only the primitive member and non-awaitable spread report.
//
// @evidence contracts/testing.md#behavioral-verification Aggregator array literals must report independently nonawaitable members.
// @evidence contracts/testing.md#independent-expectations The authored source and original assertions fix the complete rule/error line list 3,7 with code 2 and empty stdout; the added per-rule rendered oracle excludes wrong severity or unrelated diagnostic anchors.
// @evidence contracts/testing.md#distinguishing-cases Original literal number and spread boolean report; native Promise, maybe-Promise and hole entries remain unreported.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenablePromiseAggregatorLiteralMembersReport invokes the in-process check command with a real Program/Checker in the shared Go unit population; original source/configuration and all assertions remain, with no child compiler, installed consumer or native artifact build.
func TestAwaitThenablePromiseAggregatorLiteralMembersReport(t *testing.T) {
  root := seedLintProject(t, `declare const maybePromise: number | Promise<number>;
Promise.all([
  1,
  Promise.resolve(2),
  maybePromise,
  ,
  ...[true],
]);
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
    t.Fatalf("Promise aggregator literal run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 2 {
    t.Fatalf("expected 2 await-thenable findings, got %d:\n%s", got, stderr)
  }
  for _, anchor := range []string{"main.ts:3:", "main.ts:7:"} {
    if !diagnosticOutputContains(stderr, anchor) {
      t.Fatalf("missing literal-member finding at %s:\n%s", anchor, stderr)
    }
  }
  for _, clean := range []string{"main.ts:4:", "main.ts:5:"} {
    if diagnosticOutputContains(stderr, clean) {
      t.Fatalf("awaitable literal member reported at %s:\n%s", clean, stderr)
    }
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr, 3, 7)
}
