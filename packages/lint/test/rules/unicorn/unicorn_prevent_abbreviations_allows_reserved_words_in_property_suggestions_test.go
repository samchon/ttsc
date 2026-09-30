package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornPreventAbbreviationsAllowsReservedWordsInPropertySuggestions verifies that the actual rule checks two literal suggestion titles and each exact property-key edit, without an automatic fix.
//
// Property keys may use reserved words even when lexical bindings cannot; the supported property grammar independently permits class/function.
//
// @evidence contracts/testing.md#behavioral-verification The actual rule checks two literal suggestion titles and each exact property-key edit, without an automatic fix.
// @evidence contracts/testing.md#independent-expectations Property keys may use reserved words even when lexical bindings cannot; the supported property grammar independently permits class/function.
// @evidence contracts/testing.md#distinguishing-cases The property e offers class/function suggestions under the custom dictionary, contrasting with strict binding keyword controls.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsAllowsReservedWordsInPropertySuggestions owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and exact diagnostic or editor-suggestion comparisons run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsAllowsReservedWordsInPropertySuggestions(t *testing.T) {
  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    "({e: 1});\n",
    json.RawMessage(`{
      "checkVariables": false,
      "checkProperties": true,
      "extendDefaultReplacements": false,
      "replacements": {"e": {"class": true, "function": true}}
    }`),
  )
  assertUnicornRuleErrorFindingIdentities(t, unicornPreventAbbreviationsRuleName, findings)
  if len(findings) != 1 || len(findings[0].Suggestions) != 2 ||
    findings[0].Suggestions[0].Title != "Rename to `class`." ||
    findings[0].Suggestions[1].Title != "Rename to `function`." {
    t.Fatalf("unexpected reserved-word property suggestions: %+v", findings)
  }
  if len(findings[0].Fix) != 0 {
    t.Fatalf("property replacements must remain opt-in: %+v", findings[0])
  }
  for index, replacement := range []string{"class", "function"} {
    edits := findings[0].Suggestions[index].Edits
    if len(edits) != 1 || edits[0].Pos != 2 || edits[0].End != 3 || edits[0].Text != replacement {
      t.Fatalf("suggestion %d must replace only the authored e property key with %q: %+v", index, replacement, edits)
    }
  }
}
