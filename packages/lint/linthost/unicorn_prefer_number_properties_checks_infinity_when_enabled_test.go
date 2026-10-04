package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornPreferNumberPropertiesChecksInfinityWhenEnabled proves the opt-in
// path maps positive and negated Infinity to their distinct property names and
// interpolates the negated description.
//
// 1. Run the authored positive/negative Infinity source with checkInfinity enabled through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification The checker-backed rule runs with the literal option payload {"checkInfinity":true} over one `Infinity` and one `-Infinity` and must produce exactly two ordinary error findings whose messages are the authored POSITIVE_INFINITY and NEGATIVE_INFINITY texts.
// @evidence contracts/testing.md#independent-expectations The supported checkInfinity option turns on the Number.POSITIVE_INFINITY and Number.NEGATIVE_INFINITY preferences; the two literal messages and the count of two are authored in the test rather than derived from the rule's output.
// @evidence contracts/testing.md#distinguishing-cases The positive and negated constants require a set containing both authored messages and exactly two findings, rejecting a missing or duplicated message; exact range-to-message pairing is not asserted here.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesChecksInfinityWhenEnabled owns this two-constant fixture as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
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
