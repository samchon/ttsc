package linthost

import (
  "encoding/json"
  "sort"
  "testing"
)

// TestUnicornNoTypeofUndefinedCheckGlobalVariablesOption verifies the
// `checkGlobalVariables` option surfaces globals as opt-in suggestions, leaves
// local bindings on the autofix path, and rejects malformed payloads.
//
// Upstream defaults the option to false and, when it is enabled, reports a
// global with a suggestion (not an automatic fix) because rewriting an
// undeclared global throws. The suggestion label carries `!==` for a negated
// comparison and `===` otherwise. A local binding under the same option keeps
// the automatic fix, proving the option only changes how globals are handled.
// The negative twin — the option omitted, so the global is skipped entirely —
// is the skips-upstream-valid-forms case; here the ValidateOptions branch is
// pinned so a typo'd or non-boolean option fails loudly rather than silently
// defaulting.
//
//  1. With checkGlobalVariables enabled, assert each global reports a
//     suggestion (with edits, no fix) and the correct operator label.
//  2. With the option enabled, assert a local binding still reports an autofix.
//  3. Assert ValidateOptions accepts the boolean forms and rejects the rest.
func TestUnicornNoTypeofUndefinedCheckGlobalVariablesOption(t *testing.T) {
  const ruleName = "unicorn/no-typeof-undefined"
  const message = "Compare with `undefined` directly instead of using `typeof`."
  enabled := json.RawMessage(`{"checkGlobalVariables":true}`)

  globalSource := `typeof globalThis === "undefined";
typeof globalThis !== "undefined";
`
  _, _, globalFindings := runRuleFindingsSnapshot(t, ruleName, globalSource, enabled)
  if len(globalFindings) != 2 {
    t.Fatalf("expected 2 global findings, got %d: %+v", len(globalFindings), globalFindings)
  }
  sort.Slice(globalFindings, func(i, j int) bool { return globalFindings[i].Pos < globalFindings[j].Pos })
  wantTitles := []string{
    "Switch to `… === undefined`.",
    "Switch to `… !== undefined`.",
  }
  for index, finding := range globalFindings {
    if finding.Message != message || finding.Severity != SeverityError {
      t.Fatalf("global finding %d identity mismatch: %+v", index, finding)
    }
    if len(finding.Fix) != 0 {
      t.Fatalf("global finding %d must not carry an autofix: %+v", index, finding.Fix)
    }
    if len(finding.Suggestions) != 1 {
      t.Fatalf("global finding %d must carry one suggestion: %+v", index, finding.Suggestions)
    }
    if finding.Suggestions[0].Title != wantTitles[index] {
      t.Fatalf("global finding %d suggestion title: got %q want %q", index, finding.Suggestions[0].Title, wantTitles[index])
    }
    if len(finding.Suggestions[0].Edits) == 0 {
      t.Fatalf("global finding %d suggestion must carry edits", index)
    }
  }

  localSource := `let binding: unknown;
typeof binding !== "undefined";
`
  _, _, localFindings := runRuleFindingsSnapshot(t, ruleName, localSource, enabled)
  if len(localFindings) != 1 {
    t.Fatalf("expected 1 local finding, got %d: %+v", len(localFindings), localFindings)
  }
  if len(localFindings[0].Fix) == 0 {
    t.Fatalf("local finding must carry an autofix under checkGlobalVariables: %+v", localFindings[0])
  }
  if len(localFindings[0].Suggestions) != 0 {
    t.Fatalf("local finding must not carry a suggestion: %+v", localFindings[0].Suggestions)
  }

  rule := LookupRule(ruleName)
  if rule == nil {
    t.Fatal("unicorn/no-typeof-undefined is not registered")
  }
  for _, accepted := range []string{"", `{"checkGlobalVariables":true}`, `{"checkGlobalVariables":false}`, `{}`} {
    if err := validateRuleOptions(rule, json.RawMessage(accepted)); err != nil {
      t.Fatalf("ValidateOptions rejected a valid payload %q: %v", accepted, err)
    }
  }
  for _, rejected := range []string{`{"nope":true}`, `{"checkGlobalVariables":"yes"}`, `{"checkGlobalVariables":null}`, `[1,2]`, `"error"`} {
    if err := validateRuleOptions(rule, json.RawMessage(rejected)); err == nil {
      t.Fatalf("ValidateOptions accepted a malformed payload %q", rejected)
    }
  }
}
