package linthost

import (
  "strings"
  "testing"
)

// TestUnicornPreferNumberPropertiesSuggestsUnsafeIsNaN proves that isNaN with a
// non-number argument reports with a suggestion instead of an unsafe autofix,
// because Number.isNaN would change the runtime result.
//
// 1. Execute the retained source and option variants through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution requires one suggestion, no automatic fix, the authored title and the exact callee-only Number.isNaN edit.
// @evidence contracts/testing.md#independent-expectations Global isNaN coerces values while Number.isNaN does not; an any-typed input cannot justify an automatic rewrite. Literal replacement text and authored identifier offsets establish the suggestion independently.
// @evidence contracts/testing.md#distinguishing-cases The any argument retains its source until the suggestion is chosen; numeric input belongs to the automatic-fix host. The edit must preserve input and the call syntax.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesSuggestsUnsafeIsNaN owns these literal variants as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestUnicornPreferNumberPropertiesSuggestsUnsafeIsNaN(t *testing.T) {
  source := "export {};\ndeclare const input: any;\nvoid isNaN(input);\n"
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornPreferNumberPropertiesRuleName, findings)
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %+v", findings)
  }
  if len(findings[0].Fix) != 0 {
    t.Fatalf("unsafe isNaN must not carry an automatic fix, got %+v", findings[0].Fix)
  }
  if len(findings[0].Suggestions) != 1 ||
    findings[0].Suggestions[0].Title != "Replace `isNaN` with `Number.isNaN`." {
    t.Fatalf("suggestion mismatch: %+v", findings[0].Suggestions)
  }
  start := strings.Index(source, "isNaN(input)")
  edits := findings[0].Suggestions[0].Edits
  if len(edits) != 1 || edits[0].Pos != start || edits[0].End != start+len("isNaN") || edits[0].Text != "Number.isNaN" {
    t.Fatalf("unsafe isNaN suggestion must replace only the callee with Number.isNaN: %+v", edits)
  }
}
