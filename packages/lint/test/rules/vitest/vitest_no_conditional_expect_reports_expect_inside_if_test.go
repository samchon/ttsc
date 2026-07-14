package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoConditionalExpectReportsExpectInsideIf verifies vitest/no-conditional-expect flags guarded assertions.
//
// Conditional expectations can let a test pass without executing any assertion.
// This locks the ancestor walk that stops at the owning test callback instead
// of scanning unrelated outer code.
//
// 1. Parse a test with expect inside an if branch.
// 2. Enable vitest/no-conditional-expect.
// 3. Assert one diagnostic is emitted.
func TestVitestNoConditionalExpectReportsExpectInsideIf(t *testing.T) {
  file := parseTS(t, `it("checks conditionally", () => {
  if (ready) {
    expect(value).toBe(1);
  }
});
`)
  findings := NewEngine(RuleConfig{"vitest/no-conditional-expect": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
