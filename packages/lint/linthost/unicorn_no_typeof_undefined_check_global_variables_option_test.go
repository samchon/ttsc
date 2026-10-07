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
// With the option enabled, the two authored globalThis comparisons require
// suggestions instead of automatic fixes, with equality-specific labels.
// The local binding comparison still requires an automatic fix. Boolean
// option payloads are accepted while the authored malformed payloads fail.
//
//  1. With checkGlobalVariables enabled, assert each global reports a
//     suggestion (with edits, no fix) and the correct operator label.
//  2. With the option enabled, assert a local binding still reports an autofix.
//  3. Assert ValidateOptions accepts the boolean forms and rejects the rest.
//
// @evidence contracts/testing.md#behavioral-verification global comparisons become suggestions, local comparisons remain automatic fixes, and actual validateRuleOptions accepts/rejects its option vocabulary.
// @evidence contracts/testing.md#independent-expectations Literal expected messages and operator-specific suggestion titles encode the supported safety policy; authored option payloads specify boolean versus malformed inputs independently.
// @evidence contracts/testing.md#distinguishing-cases Enabled equality/inequality globals require suggestions and no fix, an enabled local requires a fix and no suggestion; empty/true/false/object options pass while unknown/null/string/nonobject inputs fail.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoTypeofUndefinedCheckGlobalVariablesOption is a discoverable Go unit host; owning checker-backed engine and option validator operations run its literal fixtures in the shared process without installation, native builds or product children. Local table/helper failures retain the source, expected replacement or option payload identity.
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
