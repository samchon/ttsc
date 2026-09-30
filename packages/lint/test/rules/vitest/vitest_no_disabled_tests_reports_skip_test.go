package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoDisabledTestsReportsSkip verifies vitest/no-disabled-tests flags skipped cases.
//
// Skipped tests silently reduce coverage. This confirms the Vitest call-chain
// parser recognizes `.skip` modifiers on normal test declarations.
//
// 1. Parse a test.skip call.
// 2. Enable vitest/no-disabled-tests.
// 3. Assert one diagnostic is emitted.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies test.skip is reported for vitest/no-disabled-tests; the count and exact rule identity distinguish the intended diagnostic from an unrelated report.
// @evidence contracts/testing.md#independent-expectations Skipping a declared case reduces executed coverage. The expected single finding and independently authored accepted control follow that supported policy, not engine-generated snapshots.
// @evidence contracts/testing.md#distinguishing-cases The original violation is paired with the adjacent accepted source: test("scheduled", () => { expect(value).toBe(1); }); Both execute, preserving the original input and adding a zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestVitestNoDisabledTestsReportsSkip owns these virtual TypeScript inputs as a Go unit entry; actual lint operations execute in-process without a Vitest installation or product child host.
func TestVitestNoDisabledTestsReportsSkip(t *testing.T) {
  file := parseTS(t, `test.skip("temporarily ignored", () => {
  expect(value).toBe(1);
});
`)
  findings := NewEngine(RuleConfig{"vitest/no-disabled-tests": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  assertVitestOrdinaryRuleErrors(t, "vitest/no-disabled-tests", findings)
  if len(findings) != 1 || findings[0].Rule != "vitest/no-disabled-tests" {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "vitest/no-disabled-tests", "test(\"scheduled\", () => { expect(value).toBe(1); });\n")
}
