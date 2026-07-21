package linthost

import (
  "strings"
  "testing"
)

// TestRequireAwaitCountsForAwaitAndPromiseReturns verifies the two shapes
// upstream exempts and this port reported.
//
// Upstream states the rule as "async functions which do not return promises and
// have no await expression", and says it "uses type information to allow
// promise-returning functions to be marked as async without containing an await
// expression". Separately, `for await (const x of source)` is spelled as a
// for-of carrying an await modifier rather than as an AwaitExpression, so a
// walker looking only for the expression form misses it. Reported externally as
// #796.
//
//  1. Write an async function whose only suspend point is a `for await`, one
//     that returns a promise without awaiting, and the two controls: an
//     ordinary loop containing an await, and a function that neither awaits nor
//     returns a promise.
//  2. Run the rule.
//  3. Assert only the last one reports.
func TestRequireAwaitCountsForAwaitAndPromiseReturns(t *testing.T) {
  source := `declare function g(): Promise<number>;
declare function ag(): AsyncIterable<number>;
async function forAwait(): Promise<void> {
  for await (const value of ag()) {
    void value;
  }
}
async function returnsPromise(): Promise<number> {
  return g();
}
async function forLoop(): Promise<void> {
  for (const _ of [1]) {
    await g();
  }
}
async function pointless(): Promise<number> {
  return 1;
}
void forAwait;
void returnsPromise;
void forLoop;
void pointless;
`
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{"typescript/require-await": "error"},
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" {
    t.Fatalf("run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/require-await]"); got != 1 {
    t.Fatalf("expected 1 finding, got %d:\n%s", got, stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:16:") {
    t.Fatalf("the function that neither awaits nor returns a promise must report:\n%s", stderr)
  }
  for _, line := range []string{"main.ts:3:", "main.ts:8:", "main.ts:11:"} {
    if diagnosticOutputContains(stderr, line) {
      t.Fatalf("exempt async function reported at %s\n%s", line, stderr)
    }
  }
}
