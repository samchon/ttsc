package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestExpectExpectReportsEmptyTest verifies vitest/expect-expect flags a test without assertions.
//
// Vitest tests that only execute code can pass without checking behavior. This
// pins the callback-body scan used by the rule before broader Jest-compatible
// assertion aliases are added.
//
// 1. Parse a test containing no expect/assert call.
// 2. Enable vitest/expect-expect.
// 3. Assert one diagnostic is emitted.
func TestVitestExpectExpectReportsEmptyTest(t *testing.T) {
  file := parseTS(t, `test("loads", () => {
  render();
});
`)
  findings := NewEngine(RuleConfig{"vitest/expect-expect": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
