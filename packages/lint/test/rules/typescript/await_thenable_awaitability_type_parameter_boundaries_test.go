package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitabilityTypeParameterBoundaries verifies the tri-state
// classifier treats an unconstrained parameter as unknown while honoring
// explicit non-awaitable and Promise constraints.
//
//  1. Await unconstrained, number-constrained, and Promise-constrained values.
//  2. Run check with typescript/await-thenable enabled as error.
//  3. Assert only the number-constrained await reports.
func TestAwaitThenableAwaitabilityTypeParameterBoundaries(t *testing.T) {
  root := seedLintProject(t, `async function unconstrained<T>(value: T): Promise<void> {
  await value;
}
async function numberConstrained<T extends number>(value: T): Promise<void> {
  await value;
}
async function promiseConstrained<T extends Promise<number>>(value: T): Promise<void> {
  await value;
}
void [unconstrained, numberConstrained, promiseConstrained];
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
    t.Fatalf("awaitability type-parameter run mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if got := strings.Count(stderr, "[typescript/await-thenable]"); got != 1 {
    t.Fatalf("expected 1 await-thenable finding, got %d:\n%s", got, stderr)
  }
  if !diagnosticOutputContains(stderr, "main.ts:5:") {
    t.Fatalf("number-constrained await was not reported:\n%s", stderr)
  }
}
