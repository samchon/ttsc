package linthost

import (
  "strings"
  "testing"
)

// TestCommandCheckRejectsInvalidNoRestrictedSyntaxSelector verifies the check
// command rejects a malformed no-restricted-syntax selector before linting.
//
// The incomplete selector must produce a configuration error rather than be
// silently dropped. This rule has no built-in denylist, so dropping its only
// selector could be silent; the explicit invalid-option/error assertions
// distinguish that outcome. The valid-selector sibling owns eval selection.
//
//  1. Seed a project containing `eval("1")`.
//  2. Configure no-restricted-syntax with the incomplete selector `CallExpression[`
//     and run `check` in this process.
//  3. Assert status 2, empty stdout, the invalid-options and invalid-selector
//     messages and no [no-restricted-syntax] diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Actual in-process check returns code two, empty stdout and invalid-option/selector errors without a rule finding.
// @evidence contracts/testing.md#independent-expectations The independently incomplete CallExpression[ selector violates grammar before any eval can be linted; literal rejection fragments identify the failure stage.
// @evidence contracts/testing.md#distinguishing-cases The only selector is malformed: explicit configuration errors distinguish rejection from silently dropping it, while rule-diagnostic absence bounds the failure stage. HonorsNoRestrictedSyntaxOptions owns the valid eval selector and adjacent clean control.
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
