package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenableAwaitUnionWithPromiseAllows verifies ordinary await accepts
// the authored Promise<number> | number operand. The Promise constituent makes
// this union possibly awaitable; scalar-only reporting is owned by
// TestAwaitThenableAwaitabilityTypeParameterBoundaries.
//
//  1. Seed a project awaiting a `Promise<number> | number` value.
//  2. Run `check` with typescript/await-thenable enabled as error.
//  3. Assert a clean exit with no await-thenable finding.
//
// @evidence contracts/testing.md#behavioral-verification A union containing a Promise must remain maybe-awaitable.
// @evidence contracts/testing.md#independent-expectations The authored Promise-containing union specifies the clean result independently: code 0, empty stdout and no rule-labelled stderr. The rendered-main.ts helper also requires zero matches; it does not certify unrelated diagnostics or other file anchors.
// @evidence contracts/testing.md#distinguishing-cases The Promise<number>|number input is clean; scalar-constrained await in AwaitabilityTypeParameterBoundaries is the positive counterpart.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenableAwaitUnionWithPromiseAllows executes the in-process check command with a real Program/Checker in the shared Go unit process. Fixture configuration is input; no child compiler, native build or installed consumer runs.
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
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr)
}
