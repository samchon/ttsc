package linthost

import (
  "testing"
)

// TestUnicornPreferSimpleConditionFirstHandlesOrChainsAndNonLogicalTypeWrappers verifies logical chains and type wrappers keep distinct decisions.
//
// Supported homogeneous logical-chain ordering and runtime-neutral type wrappers independently establish the literal results.
//
// 1. Execute the retained logical source variants through the owning Go rule.
// 2. Compare the diagnostic/edit or unchanged result at each stated boundary.
//
// @evidence contracts/testing.md#behavioral-verification The engine evaluates retained OR-chain and TypeScript wrapper inputs and compares authored diagnostic and fix expectations.
// @evidence contracts/testing.md#independent-expectations Supported homogeneous logical-chain ordering and runtime-neutral type wrappers independently establish the literal results.
// @evidence contracts/testing.md#distinguishing-cases OR chains and nonlogical wrappers remain distinct from AND and unsafe-order cases owned by neighboring hosts.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferSimpleConditionFirstHandlesOrChainsAndNonLogicalTypeWrappers owns the literal logical-expression variants as a discoverable Go unit entry; actual parser/engine/fix operations run in the shared process without a consumer installation, native producer or product child host.
func TestUnicornPreferSimpleConditionFirstHandlesOrChainsAndNonLogicalTypeWrappers(t *testing.T) {
  orSource := `declare const flag: boolean;
declare const ready: boolean;
declare const other: boolean;
if ((flag ? true : false) || ready || other) { void 0; }
`
  orExpected := `declare const flag: boolean;
declare const ready: boolean;
declare const other: boolean;
if (ready || other || (flag ? true : false)) { void 0; }
`
  _, _, findings := runRuleFindingsSnapshot(t, preferSimpleConditionFirstRule, orSource, nil)
  assertUnicornRuleErrorFindingIdentities(t, preferSimpleConditionFirstRule, findings)
  if len(findings) != 1 || findings[0].Message != "Prefer this simple condition first in the `||` expression." {
    t.Fatalf("want one exact || finding, got %+v", findings)
  }
  assertFixSnapshot(t, preferSimpleConditionFirstRule, orSource, orExpected)

  wrappedSource := `declare const flag: boolean;
declare const ready: boolean;
if (((flag ? true : false) as boolean) && ready) { void 0; }
`
  wrappedExpected := `declare const flag: boolean;
declare const ready: boolean;
if (ready && ((flag ? true : false) as boolean)) { void 0; }
`
  assertFixSnapshot(t, preferSimpleConditionFirstRule, wrappedSource, wrappedExpected)
}
