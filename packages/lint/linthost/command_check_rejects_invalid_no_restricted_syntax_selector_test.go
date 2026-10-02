package linthost

import (
  "strings"
  "testing"
)

// TestCommandCheckRejectsInvalidNoRestrictedSyntaxSelector verifies the check
// command rejects a malformed no-restricted-syntax selector before linting.
//
// The source contains an `eval` call that a well-formed selector would report,
// so a run that merely dropped the bad selector would print a rule finding. The
// configuration must instead fail as an invalid option for the rule.
//
//  1. Seed a project containing `eval("1")`.
//  2. Configure no-restricted-syntax with the incomplete selector `CallExpression[`
//     and run `check` in this process.
//  3. Assert status 2, empty stdout, the invalid-options and invalid-selector
//     messages and no [no-restricted-syntax] diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Actual in-process check returns code two, empty stdout and invalid-option/selector errors without a rule finding.
// @evidence contracts/testing.md#independent-expectations The independently incomplete CallExpression[ selector violates grammar before any eval can be linted; literal rejection fragments identify the failure stage.
// @evidence contracts/testing.md#distinguishing-cases Malformed selector suppresses the otherwise reportable original eval source; HonorsNoRestrictedSyntaxOptions owns the valid-selector counterpart.
// @evidence contracts/testing.md#execution-ownership TestCommandCheckRejectsInvalidNoRestrictedSyntaxSelector is selected in the shared Go unit population. It materializes the actual source/config fixture and calls run(check) in-process with an explicit lint manifest; no CLI child is started. No installed consumer, native artifact build or real product host runs.
func TestCommandCheckRejectsInvalidNoRestrictedSyntaxSelector(t *testing.T) {
  root := seedLintProject(t, `eval("1");
`)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "no-restricted-syntax": []any{"error", "CallExpression["},
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, `invalid options for rule "no-restricted-syntax"`) ||
    !strings.Contains(stderr, "invalid selector") || strings.Contains(stderr, "[no-restricted-syntax]") {
    t.Fatalf("invalid command path mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
