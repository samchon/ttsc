package linthost

import (
  "strings"
  "testing"
)

// TestUnicornPreferNumberPropertiesInterpolatesMessage verifies the authored
// message substitutes the real spellings rather than emitting
// literal <X> placeholders. It does not certify a historical implementation.
//
// 1. Run the authored radix-2 parseInt fixture under default options through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution requires one diagnostic with the full substituted parseInt message and rejects literal placeholder text.
// @evidence contracts/testing.md#independent-expectations The supported diagnostic names Number.parseInt and parseInt; the authored full message distinguishes missing interpolation independently of the product formatter.
// @evidence contracts/testing.md#distinguishing-cases The radix-2 global call owns the reported message boundary; TestRuleCorpusUnicornPreferNumberProperties separately retains relaxed and shadowed call controls.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesInterpolatesMessage owns this literal message fixture as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestUnicornPreferNumberPropertiesInterpolatesMessage(t *testing.T) {
  source := "export {};\nconst raw = \"10\";\nvoid parseInt(raw, 2);\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornPreferNumberPropertiesRuleName, findings)
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %+v", findings)
  }
  want := "Prefer `Number.parseInt` over `parseInt`."
  if findings[0].Message != want {
    t.Fatalf("message not interpolated: want %q, got %q", want, findings[0].Message)
  }
  if strings.Contains(findings[0].Message, "<X>") {
    t.Fatalf("message still carries the literal placeholder: %q", findings[0].Message)
  }
}
