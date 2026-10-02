package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableForAwaitOfSyncIterableReports verifies the `for await...of`
// arm of typescript/await-thenable reports the three authored sync iterable
// forms under a real Program: a number array, a sync generator and a sync array
// of Promises. None exposes Symbol.asyncIterator, even when its yielded values
// are Promises. Exact columns anchor each finding on the iterable expression.
//
//  1. Seed a project with three `for await` loops over sync iterables.
//  2. Run `check` with typescript/await-thenable enabled as error.
//  3. Assert exactly three findings, each anchored at its iterable
//     expression, with the upstream message text.
//
// @evidence contracts/testing.md#behavioral-verification For-await over definitely synchronous iterables must report the supported upstream lint policy.
// @evidence contracts/testing.md#independent-expectations The supported sync-iterator lint policy and authored three loops independently require errors at main.ts:2:29, main.ts:8:27 and main.ts:12:32, code 2, empty stdout and the literal protocol message. Rule-label count rejects extras; the rendered-main.ts helper checks lines 2,8,12 and error severity without certifying unrelated diagnostics.
// @evidence contracts/testing.md#distinguishing-cases Number array, sync generator and even a synchronous array of Promises report with original iterable-expression columns; AsyncIterableAllows supplies async protocol controls. JavaScript execution legality is not the oracle.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenableForAwaitOfSyncIterableReports invokes the in-process check command with a real Program/Checker in the shared Go unit population; original source/configuration and all assertions remain, with no child compiler, installed consumer or native artifact build.
func TestAwaitThenableForAwaitOfSyncIterableReports(t *testing.T) {
  root := seedLintProject(t, `async function main(): Promise<void> {
  for await (const value of [1, 2, 3]) {
    JSON.stringify(value);
  }
  function* nums(): Generator<number> {
    yield 1;
  }
  for await (const num of nums()) {
    JSON.stringify(num);
  }
  const promises = [Promise.resolve(1), Promise.resolve(2)];
  for await (const resolved of promises) {
    JSON.stringify(resolved);
  }
}
void main();
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
    t.Fatalf("for-await-of sync iterable run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 3 {
    t.Fatalf("expected 3 await-thenable findings, got %d:\n%s", got, stderr)
  }
  if !strings.Contains(stderr, "Unexpected `for await...of` of a value that is not async iterable.") {
    t.Fatalf("missing upstream for-await-of message:\n%s", stderr)
  }
  for _, anchor := range []string{"main.ts:2:29", "main.ts:8:27", "main.ts:12:32"} {
    if !diagnosticOutputContains(stderr, anchor) {
      t.Fatalf("finding not anchored at iterable expression %s:\n%s", anchor, stderr)
    }
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr, 2, 8, 12)
}
