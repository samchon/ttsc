package linthost

import (
  "testing"
)

// TestUnicornConsistentFunctionScopingResolvesJSXComponentCaptures distinguishes component bindings from intrinsic tag names.
//
// Component identifiers resolve lexically while intrinsic tags do not name that enclosing value binding; authored TSX determines the expected distinction.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification The checker distinguishes outer JSX component identifiers from intrinsic tag names.
// @evidence contracts/testing.md#independent-expectations Component identifiers resolve lexically while intrinsic tags do not name that enclosing value binding; authored TSX determines the expected distinction.
// @evidence contracts/testing.md#distinguishing-cases Outer component captures remain pinned while intrinsic-only functions report.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingResolvesJSXComponentCaptures owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingResolvesJSXComponentCaptures(t *testing.T) {
  source := `declare namespace JSX {
  interface Element {}
  interface IntrinsicElements { section: {}; }
}
function capturesComponent(Component: () => JSX.Element): () => JSX.Element {
  function render(): JSX.Element { return <Component />; }
  return render;
}
function ignoresIntrinsicTag(): () => JSX.Element {
  function movable(): JSX.Element { return <section />; }
  return movable;
}
void [capturesComponent, ignoresIntrinsicTag];
`
  _, _, findings := runRuleFindingsSnapshotFile(
    t,
    unicornConsistentFunctionScopingRuleName,
    "main.tsx",
    source,
    nil,
  )
  assertUnicornRuleErrorFindingIdentities(t, unicornConsistentFunctionScopingRuleName, findings)
  if len(findings) != 1 || findings[0].Message != "Move function 'movable' to the outer scope." {
    t.Fatalf("JSX reference analysis mismatch: %+v", findings)
  }
}
