package linthost

import (
  "testing"
)

// TestUnicornConsistentFunctionScopingKeepsSharedOuterReferencesTogether keeps functions beside shared outer reads and writes.
//
// An enclosing read/write dependency independently prevents lifting a function as if capture-free.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification Actual engine execution checks retained nested functions sharing outer reads and writes.
// @evidence contracts/testing.md#independent-expectations An enclosing read/write dependency independently prevents lifting a function as if capture-free.
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
