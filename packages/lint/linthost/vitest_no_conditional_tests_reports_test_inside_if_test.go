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
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies a test declaration under if is reported for vitest/no-conditional-tests; the count and exact rule identity distinguish the intended diagnostic from an unrelated report.
// @evidence contracts/testing.md#independent-expectations Registration must not depend on a runtime conditional. The expected single finding and independently authored accepted control follow that supported policy, not engine-generated snapshots.
// @evidence contracts/testing.md#distinguishing-cases The original violation is paired with the adjacent accepted source: test("always registered", () => expect(true).toBe(true)); Both execute, preserving the original input and adding a zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestVitestNoConditionalTestsReportsTestInsideIf owns these virtual TypeScript inputs as a Go unit entry; actual lint operations execute in-process without a Vitest installation or product child host.
func TestVitestNoConditionalTestsReportsTestInsideIf(t *testing.T) {
  file := parseTS(t, `if (process.env.CI) {
  test("ci only", () => expect(true).toBe(true));
}
`)
  findings := NewEngine(RuleConfig{"vitest/no-conditional-tests": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  assertVitestOrdinaryRuleErrors(t, "vitest/no-conditional-tests", findings)
  if len(findings) != 1 || findings[0].Rule != "vitest/no-conditional-tests" {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "vitest/no-conditional-tests", "test(\"always registered\", () => expect(true).toBe(true));\n")
}
