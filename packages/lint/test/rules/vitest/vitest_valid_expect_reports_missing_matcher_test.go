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
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies bare expect(value) is reported for vitest/valid-expect; the count and exact rule identity distinguish the intended diagnostic from an unrelated report.
// @evidence contracts/testing.md#independent-expectations A matcher must complete the assertion chain. The expected single finding and independently authored accepted control follow that supported policy, not engine-generated snapshots.
// @evidence contracts/testing.md#distinguishing-cases The original violation is paired with the adjacent accepted source: test("matcher", () => { expect(value).toBe(1); }); Both execute, preserving the original input and adding a zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestVitestValidExpectReportsMissingMatcher owns these virtual TypeScript inputs as a Go unit entry; actual lint operations execute in-process without a Vitest installation or product child host.
func TestVitestValidExpectReportsMissingMatcher(t *testing.T) {
  file := parseTS(t, `test("bare", () => {
  expect(value);
});
`)
  findings := NewEngine(RuleConfig{"vitest/valid-expect": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  assertVitestOrdinaryRuleErrors(t, "vitest/valid-expect", findings)
  if len(findings) != 1 || findings[0].Rule != "vitest/valid-expect" {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "vitest/valid-expect", "test(\"matcher\", () => { expect(value).toBe(1); });\n")
}
