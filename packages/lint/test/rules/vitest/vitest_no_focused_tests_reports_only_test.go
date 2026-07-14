package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoFocusedTestsReportsOnly verifies vitest/no-focused-tests flags focused tests.
//
// A committed `.only` causes CI to run only part of the suite. This confirms
// the rule recognizes chained Vitest modifiers rather than only bare calls.
//
// 1. Parse a test.only call.
// 2. Enable vitest/no-focused-tests.
// 3. Assert one diagnostic is emitted.
func TestVitestNoFocusedTestsReportsOnly(t *testing.T) {
  file := parseTS(t, `test.only("focused", () => {
  expect(value).toBe(1);
});
`)
  findings := NewEngine(RuleConfig{"vitest/no-focused-tests": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
