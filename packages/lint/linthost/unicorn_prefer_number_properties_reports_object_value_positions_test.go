package linthost

import (
  "testing"
)

// TestUnicornPreferNumberPropertiesReportsObjectValuePositions locks the
// dropped-value-position bug: the initializer of a property (`parseFloat`) and a
// shorthand (`parseInt`) are both references and must each report.
//
// 1. Execute the retained source and option variants through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification The engine must report both parseFloat property-value and parseInt shorthand references with their respective authored messages.
// @evidence contracts/testing.md#independent-expectations Both object value positions refer to global numeric helpers and independently require Number-qualified alternatives under the supported rule policy.
// @evidence contracts/testing.md#distinguishing-cases Property initializer and shorthand each report; their literal message set rejects a duplicated or dropped helper finding.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesReportsObjectValuePositions owns these literal variants as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestUnicornPreferNumberPropertiesReportsObjectValuePositions(t *testing.T) {
  source := "export {};\nconst options = { normalize: parseFloat, parseInt };\nvoid options;\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornPreferNumberPropertiesRuleName, findings)
  if len(findings) != 2 {
    t.Fatalf("want findings for parseFloat and parseInt, got %+v", findings)
  }
  messages := map[string]bool{}
  for _, finding := range findings {
    messages[finding.Message] = true
  }
  for _, want := range []string{
    "Prefer `Number.parseFloat` over `parseFloat`.",
    "Prefer `Number.parseInt` over `parseInt`.",
  } {
    if !messages[want] {
      t.Fatalf("missing %q in %+v", want, findings)
    }
  }
}
