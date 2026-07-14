package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoConditionalTestsReportsTestInsideIf verifies vitest/no-conditional-tests rejects guarded declarations.
//
// Vitest discovers tests at module evaluation time, so conditional declaration
// makes the executed test set depend on runtime state. This pins the simple
// conditional-ancestor check for test and describe calls.
//
// 1. Parse a test call nested in an if statement.
// 2. Enable vitest/no-conditional-tests.
// 3. Assert one diagnostic is emitted.
func TestVitestNoConditionalTestsReportsTestInsideIf(t *testing.T) {
  file := parseTS(t, `if (process.env.CI) {
  test("ci only", () => expect(true).toBe(true));
}
`)
  findings := NewEngine(RuleConfig{"vitest/no-conditional-tests": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
