package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoStandaloneExpectReportsTopLevelExpect verifies vitest/no-standalone-expect rejects module-scope assertions.
//
// Top-level expect calls run during module loading rather than as a test case.
// This locks the callback ancestry check used to keep assertions inside tests
// or hooks.
//
// 1. Parse a module-scope expect call.
// 2. Enable vitest/no-standalone-expect.
// 3. Assert one diagnostic is emitted.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies module-scope expect is reported for vitest/no-standalone-expect; the count and exact rule identity distinguish the intended diagnostic from an unrelated report.
// @evidence contracts/testing.md#independent-expectations Only a test-owned assertion contributes to a test result. The expected single finding and independently authored accepted control follow that supported policy, not engine-generated snapshots.
// @evidence contracts/testing.md#distinguishing-cases The original violation is paired with the adjacent accepted source: test("owned", () => { expect(value).toBe(1); }); Both execute, preserving the original input and adding a zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestVitestNoStandaloneExpectReportsTopLevelExpect owns these virtual TypeScript inputs as a Go unit entry; actual lint operations execute in-process without a Vitest installation or product child host.
func TestVitestNoStandaloneExpectReportsTopLevelExpect(t *testing.T) {
  file := parseTS(t, `expect(value).toBe(1);
`)
  findings := NewEngine(RuleConfig{"vitest/no-standalone-expect": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  assertVitestOrdinaryRuleErrors(t, "vitest/no-standalone-expect", findings)
  if len(findings) != 1 || findings[0].Rule != "vitest/no-standalone-expect" {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "vitest/no-standalone-expect", "test(\"owned\", () => { expect(value).toBe(1); });\n")
}
