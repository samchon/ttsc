package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitUnionWithPromiseAllows verifies an ordinary `await`
// over a maybe-thenable union stays clean after the rule's multi-construct
// dispatch split.
//
// Regression guard for the pre-existing await arm: upstream intentionally
// distinguishes always/never/maybe-thenable operands, so
// `Promise<number> | number` must not report. Extending the rule to
// `for await...of` and `await using` restructured `Check` into a kind
// switch; this pins that the union-constituent walk in `isAwaitable` still
// runs for KindAwaitExpression and the new arms did not turn the rule into a
// blanket ban on mixed unions.
//
//  1. Seed a project awaiting a `Promise<number> | number` value.
//  2. Run `check` with typescript/await-thenable enabled as error.
//  3. Assert a clean exit with no await-thenable finding.
func TestAwaitThenableAwaitUnionWithPromiseAllows(t *testing.T) {
  root := seedLintProject(t, `declare const maybePromise: Promise<number> | number;
async function main(): Promise<void> {
  const resolved = await maybePromise;
  JSON.stringify(resolved);
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
  if code != 0 || stdout != "" || strings.Contains(stderr, "[typescript/await-thenable]") {
    t.Fatalf("maybe-thenable union await was reported: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
