package linthost

import (
  "testing"
)

// TestUnicornConsistentFunctionScopingKeepsSharedOuterReferencesTogether keeps functions beside shared outer reads and writes.
//
// The authored rule-policy expectation keeps the nested function beside the outer read/write uses of the same global binding; it does not certify that relocation would change runtime semantics.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification Actual engine execution checks retained nested functions sharing outer reads and writes.
// @evidence contracts/testing.md#independent-expectations The authored rule-policy expectation keeps the nested function beside the outer read/write uses of the same global binding; it does not certify that relocation would change runtime semantics.
// @evidence contracts/testing.md#distinguishing-cases Original shared outer read/write cases stay clean, unlike capture-free corpus functions.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingKeepsSharedOuterReferencesTogether owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingKeepsSharedOuterReferencesTogether(t *testing.T) {
  source := `let shared = 0;
function outer(): number {
  shared += 1;
  function readsShared(): number { return shared; }
  return shared + readsShared();
}
void outer;
`
  assertRuleSkipsSource(t, unicornConsistentFunctionScopingRuleName, source)
}
