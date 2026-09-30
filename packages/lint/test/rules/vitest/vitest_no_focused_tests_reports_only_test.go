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
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies test.only is reported for vitest/no-focused-tests; the count and exact rule identity distinguish the intended diagnostic from an unrelated report.
// @evidence contracts/testing.md#independent-expectations Focusing one declaration excludes sibling tests. The expected single finding and independently authored accepted control follow that supported policy, not engine-generated snapshots.
// @evidence contracts/testing.md#distinguishing-cases The original violation is paired with the adjacent accepted source: test("ordinary", () => { expect(value).toBe(1); }); Both execute, preserving the original input and adding a zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestVitestNoFocusedTestsReportsOnly owns these virtual TypeScript inputs as a Go unit entry; actual lint operations execute in-process without a Vitest installation or product child host.
func TestVitestNoFocusedTestsReportsOnly(t *testing.T) {
  file := parseTS(t, `test.only("focused", () => {
  expect(value).toBe(1);
});
`)
  findings := NewEngine(RuleConfig{"vitest/no-focused-tests": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  assertVitestOrdinaryRuleErrors(t, "vitest/no-focused-tests", findings)
  if len(findings) != 1 || findings[0].Rule != "vitest/no-focused-tests" {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "vitest/no-focused-tests", "test(\"ordinary\", () => { expect(value).toBe(1); });\n")
}
