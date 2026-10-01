package linthost

import (
  "encoding/json"
  "testing"
)

// TestUnicornConsistentFunctionScopingHonorsCheckArrowFunctions disables arrow reports while retaining declaration reports.
//
// The supported checkArrowFunctions false option independently suppresses only the arrow branch.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution disables arrow checking while retaining declaration reports.
// @evidence contracts/testing.md#independent-expectations The supported checkArrowFunctions false option independently suppresses only the arrow branch.
// @evidence contracts/testing.md#distinguishing-cases The disabled arrow is clean and the function declaration remains reported.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingHonorsCheckArrowFunctions owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingHonorsCheckArrowFunctions(t *testing.T) {
  source := `function outer(): void {
  const arrow = (): number => 1;
  function declaration(): number { return 1; }
  void [arrow, declaration];
}
void outer;
`
  _, _, defaults := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornConsistentFunctionScopingRuleName, defaults)
  if len(defaults) != 2 {
    t.Fatalf("default options should check both definitions, got %+v", defaults)
  }
  _, _, configured := runRuleFindingsSnapshot(
    t,
    unicornConsistentFunctionScopingRuleName,
    source,
    json.RawMessage(`{"checkArrowFunctions":false}`),
  )
  assertUnicornRuleErrorFindingIdentities(t, unicornConsistentFunctionScopingRuleName, configured)
  if len(configured) != 1 || configured[0].Message != "Move function 'declaration' to the outer scope." {
    t.Fatalf("disabled arrow checking mismatch: %+v", configured)
  }
}
