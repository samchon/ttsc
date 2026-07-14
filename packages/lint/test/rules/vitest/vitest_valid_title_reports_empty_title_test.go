package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestValidTitleReportsEmptyTitle verifies vitest/valid-title rejects empty static titles.
//
// Empty test names make reports and focused reruns hard to interpret. This
// pins the static-title branch without depending on dynamic template analysis.
//
// 1. Parse a test with an empty string title.
// 2. Enable vitest/valid-title.
// 3. Assert one diagnostic is emitted.
func TestVitestValidTitleReportsEmptyTitle(t *testing.T) {
  file := parseTS(t, `test("", () => {
  expect(value).toBe(1);
});
`)
  findings := NewEngine(RuleConfig{"vitest/valid-title": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
}
