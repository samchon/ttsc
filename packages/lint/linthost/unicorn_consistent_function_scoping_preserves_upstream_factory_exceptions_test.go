package linthost

import (
  "testing"
)

// TestUnicornConsistentFunctionScopingPreservesUpstreamFactoryExceptions distinguishes immediate factory children from deeper definitions.
//
// The supported factory policy independently exempts immediate React/IIFE children and the retained Jest mock descendants.
//
// 1. Execute the retained lexical source or option variants.
// 2. Check their authored diagnostic, range or configuration result.
//
// @evidence contracts/testing.md#behavioral-verification The real engine checks retained React hook, IIFE and Jest mock factory exemptions by nesting depth.
// @evidence contracts/testing.md#independent-expectations The supported factory policy independently exempts immediate React/IIFE children and the retained Jest mock descendants.
// @evidence contracts/testing.md#distinguishing-cases React/IIFE immediate children stay clean but deeper functions report; Jest mock descendants retain their separate exemption.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentFunctionScopingPreservesUpstreamFactoryExceptions owns its explicit variants as a discoverable Go unit entry; checker and engine operations execute in the shared process with isolated fixtures and no installed consumer, native producer or product child host.
func TestUnicornConsistentFunctionScopingPreservesUpstreamFactoryExceptions(t *testing.T) {
  t.Run("React hook and IIFE only exempt immediate children", func(t *testing.T) {
    source := `declare function useEffect(callback: () => void, dependencies: readonly unknown[]): void;
useEffect(() => {
  function immediate(): void {
    function nested(): void {}
    void nested;
  }
  void immediate;
}, []);
(function (): void {
  function immediateIIFE(): void {
    function nestedIIFE(): void {}
    void nestedIIFE;
  }
  void immediateIIFE;
})();
`
    _, _, findings := runRuleFindingsSnapshot(t, unicornConsistentFunctionScopingRuleName, source, nil)
    assertUnicornRuleErrorFindingIdentities(t, unicornConsistentFunctionScopingRuleName, findings)
    if len(findings) != 2 {
      t.Fatalf("want only the two deeply nested functions, got %+v", findings)
    }
    if findings[0].Message != "Move function 'nested' to the outer scope." ||
      findings[1].Message != "Move function 'nestedIIFE' to the outer scope." {
      t.Fatalf("factory exception messages mismatch: %+v", findings)
    }
  })

  t.Run("Jest mock factory excludes every depth", func(t *testing.T) {
    source := `declare const jest: { mock(name: string, factory: () => unknown): void };
jest.mock("module", () => {
  function createMock(): string {
    const nested = (): string => "mock";
    return nested();
  }
  return createMock;
});
`
    assertRuleSkipsSource(t, unicornConsistentFunctionScopingRuleName, source)
  })
}
