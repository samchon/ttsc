package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestValidExpectReportsMissingMatcher verifies vitest/valid-expect rejects bare expect calls.
//
// `expect(value)` without a matcher records no assertion. This pins the
// matcher-chain traversal that accepts `.not`, `.resolves`, and `.rejects`
// before the final matcher call.
//
// 1. Parse a test containing a bare expect call.
// 2. Enable vitest/valid-expect.
// 3. Assert one diagnostic is emitted.
func TestVitestValidExpectReportsMissingMatcher(t *testing.T) {
  file := parseTS(t, `test("bare", () => {
  expect(value);
});
`)
  findings := NewEngine(RuleConfig{"vitest/valid-expect": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
