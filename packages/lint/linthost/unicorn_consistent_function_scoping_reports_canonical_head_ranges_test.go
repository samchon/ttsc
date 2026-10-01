package linthost

import (
  "strings"
  "testing"
)

// TestUnicornConsistentFunctionScopingReportsCanonicalHeadRanges anchors generator and arrow reports at their authored heads.
//
// The supported declaration-head and arrow-token anchor contract independently establishes literal ranges and messages.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution compares async-generator and arrow findings with authored head offsets/messages.
// @evidence contracts/testing.md#independent-expectations The supported declaration-head and arrow-token anchor contract independently establishes literal ranges and messages.
// @evidence contracts/testing.md#distinguishing-cases Async generator head and arrow token retain their distinct exact positions.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingReportsCanonicalHeadRanges owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingReportsCanonicalHeadRanges(t *testing.T) {
  source := `function outer(): void {
  async function* nested(): AsyncGenerator<void> {}
  const arrow = async (): Promise<void> => {};
  void [nested, arrow];
}
void outer;
`
  _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornConsistentFunctionScopingRuleName, findings)
  if len(findings) != 2 {
    t.Fatalf("want two findings, got %+v", findings)
  }

  functionStart := strings.Index(source, "async function* nested")
  functionEnd := functionStart + len("async function* nested")
  if findings[0].Pos != functionStart || findings[0].End != functionEnd ||
    findings[0].Message != "Move async generator function 'nested' to the outer scope." {
    t.Fatalf("function head mismatch: %+v", findings[0])
  }
  arrowStart := strings.LastIndex(source, "=>")
  if findings[1].Pos != arrowStart || findings[1].End != arrowStart+2 ||
    findings[1].Message != "Move async arrow function 'arrow' to the outer scope." {
    t.Fatalf("arrow head mismatch: %+v", findings[1])
  }
}
