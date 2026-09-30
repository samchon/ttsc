package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornPreventAbbreviationsPropertyChecksAreOptInAndSuggestionOnly verifies that the engine checks clean defaults and two enabled property findings with suggestions but no autofix.
//
// The supported property opt-in and ambiguous e dictionary independently prevent an automatic public-property rename.
//
// 1. Execute the retained binding, filename, option or command variants.
// 2. Compare the authored diagnostic, edit, helper value or preserved source.
//
// @evidence contracts/testing.md#behavioral-verification The engine checks clean defaults and two enabled property findings with suggestions but no autofix.
// @evidence contracts/testing.md#independent-expectations The supported property opt-in and ambiguous e dictionary independently prevent an automatic public-property rename.
// @evidence contracts/testing.md#distinguishing-cases Property declaration/write are clean by default and each receive two suggestions when property checking is enabled.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsPropertyChecksAreOptInAndSuggestionOnly owns its explicit variants and named subcases where present as a discoverable Go unit entry; actual checker/engine/fix/filename/casing operations run in the shared process with isolated fixture files and no installed consumer, native producer or product child host.
func TestUnicornPreventAbbreviationsPropertyChecksAreOptInAndSuggestionOnly(t *testing.T) {
  source := "class Store {\n  e = 0;\n  update(): void {\n    this.e = 1;\n  }\n}\nvoid Store;\n"
  assertRuleSkipsSource(t, unicornPreventAbbreviationsRuleName, source)
  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    json.RawMessage(`{"checkVariables":false,"checkProperties":true}`),
  )
  assertUnicornRuleErrorFindingIdentities(t, unicornPreventAbbreviationsRuleName, findings)
  if len(findings) != 2 {
    t.Fatalf("expected property definition and write diagnostics, got %d (%+v)", len(findings), findings)
  }
  for _, finding := range findings {
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 2 {
      t.Fatalf("properties must be suggestion-only for ambiguous names: %+v", finding)
    }
  }
}
