package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoDoneCallbackReportsTestParameter verifies vitest/no-done-callback rejects callback-style async tests.
//
// Vitest tests should return or await promises instead of accepting a done
// callback. This locks the callback-argument lookup for test declarations.
//
// 1. Parse a test callback with one parameter.
// 2. Enable vitest/no-done-callback.
// 3. Assert one diagnostic is emitted.
func TestVitestNoDoneCallbackReportsTestParameter(t *testing.T) {
  file := parseTS(t, `it("uses callback", (done) => {
  done();
});
`)
  findings := NewEngine(RuleConfig{"vitest/no-done-callback": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
