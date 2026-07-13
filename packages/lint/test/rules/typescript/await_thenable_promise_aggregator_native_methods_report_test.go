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
}
