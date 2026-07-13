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
}
