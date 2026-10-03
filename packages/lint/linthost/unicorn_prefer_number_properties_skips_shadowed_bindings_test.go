package linthost

import (
  "testing"
)

// TestUnicornPreferNumberPropertiesSkipsShadowedBindings verifies a locally
// declared, parameter or destructured binding of a tracked name is treated as a distinct
// value, so neither the shadowed `isNaN` call nor the shadowed `parseInt` fires.
//
// 1. Execute the retained source and option variants through the owning Go operation.
// 2. Assert the concrete diagnostic or authored full-source result described here.
//
// @evidence contracts/testing.md#behavioral-verification Actual binding resolution preserves locally declared numeric helper names rather than mistaking them for globals.
// @evidence contracts/testing.md#independent-expectations A lexical binding is a different function from the global helper; independently authored local declarations require zero findings.
// @evidence contracts/testing.md#distinguishing-cases Retained local parameter/declaration/destructured bindings stay clean; the corpus and global-fix hosts own actual global references.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferNumberPropertiesSkipsShadowedBindings owns these literal variants as a discoverable Go unit entry; checker and rule/fix operations execute in the shared process without installing a consumer, building a native producer or starting a product host.
func TestUnicornPreferNumberPropertiesSkipsShadowedBindings(t *testing.T) {
  source := `export {};
const value: unknown = 0;
{
  const isNaN = (input: unknown): boolean => input !== input;
  void isNaN(value);
}
{
  const { parseInt } = Number;
  void parseInt("10", 2);
}
function localHelpers(isNaN: (input: unknown) => boolean, parseInt: (input: string, radix: number) => number): void {
  void isNaN(value);
  void parseInt("10", 2);
}
void localHelpers;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornPreferNumberPropertiesRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornPreferNumberPropertiesRuleName, findings)
  if len(findings) != 0 {
    t.Fatalf("shadowed bindings must not fire, got %+v", findings)
  }
}
