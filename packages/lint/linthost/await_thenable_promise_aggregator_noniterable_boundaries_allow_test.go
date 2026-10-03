package linthost

import (
  "strings"
  "testing"
)

// TestAwaitThenablePromiseAggregatorNoniterableBoundariesAllow verifies the
// rule leaves missing and non-iterable arguments to the TypeScript checker
// instead of adding an unrelated await-thenable finding.
//
//  1. Suppress compiler errors for a missing and a numeric all argument.
//  2. Run check with typescript/await-thenable enabled as error.
//  3. Assert neither malformed call produces a lint finding.
//
// @evidence contracts/testing.md#behavioral-verification Malformed noniterable aggregator calls must not receive unsupported iterable lint findings.
// @evidence contracts/testing.md#independent-expectations The authored missing and numeric arguments, with explicit compiler suppressions, independently require code 0, empty stdout and no rule-labelled stderr. The rendered-main.ts helper also requires zero matches; it does not certify validity without suppressions or unrelated diagnostic anchors.
// @evidence contracts/testing.md#distinguishing-cases Missing argument and number argument stay lint-clean with intentional TypeScript suppression; NativeMethodsReport covers actual iterable scalar positives. No claim that malformed calls are valid without suppression is made.
// @evidence contracts/testing.md#execution-ownership TestAwaitThenablePromiseAggregatorNoniterableBoundariesAllow invokes the in-process check command with a real Program/Checker in the shared Go unit population; original source/configuration and all assertions remain, with no child compiler, installed consumer or native artifact build.
func TestAwaitThenablePromiseAggregatorNoniterableBoundariesAllow(t *testing.T) {
  root := seedLintProject(t, `// @ts-expect-error: intentionally missing required iterable
Promise.all();
// @ts-expect-error: intentionally non-iterable argument
Promise.all(1);
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
    t.Fatalf("malformed Promise aggregator call was linted: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/await-thenable", stderr)
}
