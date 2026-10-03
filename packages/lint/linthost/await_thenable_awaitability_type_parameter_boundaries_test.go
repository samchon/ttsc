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
//
// @evidence contracts/testing.md#behavioral-verification Type-parameter awaitability must distinguish definitely scalar constraints from unknown or Promise constraints.
// @evidence contracts/testing.md#independent-expectations The authored unconstrained, number-constrained and Promise-constrained operands independently require one error on line 5, code 2 and empty stdout. Rule-label counting rejects extras, and the rendered-main.ts helper checks line and error severity; unrelated diagnostics are outside that helper's scope.
// @evidence contracts/testing.md#distinguishing-cases Unconstrained T and Promise-constrained T remain clean beside number-constrained T.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenableAwaitabilityTypeParameterBoundaries executes the in-process check command with a real Program/Checker in the shared Go unit process. Fixture configuration is input; no child compiler, native build or installed consumer runs.
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
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr, 5)
}
