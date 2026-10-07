package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoTestReturnStatementReportsReturn verifies vitest/no-test-return-statement flags returned values.
//
// This lint policy rejects explicit return statements inside test callbacks.
// The case compares a returned call with an expression statement; it does not
// determine the call's return type or test Vitest's promise completion behavior.
//
// 1. Parse a test callback with a return statement.
// 2. Enable vitest/no-test-return-statement.
// 3. Assert one diagnostic is emitted.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies a callback return statement is reported for vitest/no-test-return-statement; the count and exact rule identity distinguish the intended diagnostic from an unrelated report.
// @evidence contracts/testing.md#independent-expectations An arbitrary returned value does not assert behavior. The expected single finding and independently authored accepted control follow that supported policy, not engine-generated snapshots.
// @evidence contracts/testing.md#distinguishing-cases The original violation is paired with the adjacent accepted source: test("expression", () => { buildValue(); }); Both execute, preserving the original input and adding a zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestVitestNoTestReturnStatementReportsReturn owns these virtual TypeScript inputs as a Go unit entry; actual lint operations execute in-process without a Vitest installation or product child host.
func TestVitestNoTestReturnStatementReportsReturn(t *testing.T) {
  file := parseTS(t, `test("returns", () => {
  return buildValue();
});
`)
  findings := NewEngine(RuleConfig{"vitest/no-test-return-statement": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  assertVitestOrdinaryRuleErrors(t, "vitest/no-test-return-statement", findings)
  if len(findings) != 1 || findings[0].Rule != "vitest/no-test-return-statement" {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "vitest/no-test-return-statement", "test(\"expression\", () => { buildValue(); });\n")
}
