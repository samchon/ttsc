package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornPreferNumberPropertiesChecksInfinityWhenEnabled proves the opt-in
// path maps positive and negated Infinity to their distinct property names and
// interpolates the negated description.
//
// 1. Execute the retained source and option variants through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution enables checkInfinity and requires the global constant to report.
// @evidence contracts/testing.md#independent-expectations The supported option turns on the Number.POSITIVE_INFINITY preference; a literal enabled payload independently requires a finding.
// @evidence contracts/testing.md#distinguishing-cases Enabled Infinity is reported; LeavesInfinityAndNaNUnderDefaults owns default-off silence and FixesNegativeInfinity owns the unary form.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesChecksInfinityWhenEnabled owns these literal variants as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestUnicornPreferNumberPropertiesChecksInfinityWhenEnabled(t *testing.T) {
  source := "export {};\nconst positive = Infinity;\nconst negative = -Infinity;\nvoid [positive, negative];\n"
  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornPreferNumberPropertiesRuleName,
    source,
    json.RawMessage(`{"checkInfinity":true}`),
  )
  assertUnicornRuleErrorFindingIdentities(t, unicornPreferNumberPropertiesRuleName, findings)
  if len(findings) != 2 {
    t.Fatalf("checkInfinity should report both, got %+v", findings)
  }
  messages := map[string]bool{}
  for _, finding := range findings {
    messages[finding.Message] = true
  }
  for _, want := range []string{
    "Prefer `Number.POSITIVE_INFINITY` over `Infinity`.",
    "Prefer `Number.NEGATIVE_INFINITY` over `-Infinity`.",
  } {
    if !messages[want] {
      t.Fatalf("missing %q in %+v", want, findings)
    }
  }
}
