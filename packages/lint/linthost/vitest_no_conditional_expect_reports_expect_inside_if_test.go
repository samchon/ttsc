package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoConditionalExpectReportsExpectInsideIf verifies vitest/no-conditional-expect flags guarded assertions.
//
// Conditional expectations can let a test pass without executing any assertion.
// This locks the ancestor walk that stops at the owning test callback instead
// of scanning unrelated outer code.
//
// 1. Parse a test with expect inside an if branch.
// 2. Enable vitest/no-conditional-expect.
// 3. Assert one diagnostic is emitted.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies an expect under if is reported for vitest/no-conditional-expect; the count and exact rule identity distinguish the intended diagnostic from an unrelated report.
// @evidence contracts/testing.md#independent-expectations An assertion guarded by runtime state can be omitted. The expected single finding and independently authored accepted control follow that supported policy, not engine-generated snapshots.
// @evidence contracts/testing.md#distinguishing-cases The original violation is paired with the adjacent accepted source: it("always", () => { expect(value).toBe(1); }); Both execute, preserving the original input and adding a zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestVitestNoConditionalExpectReportsExpectInsideIf owns these virtual TypeScript inputs as a Go unit entry; actual lint operations execute in-process without a Vitest installation or product child host.
func TestVitestNoConditionalExpectReportsExpectInsideIf(t *testing.T) {
  file := parseTS(t, `it("checks conditionally", () => {
  if (ready) {
    expect(value).toBe(1);
  }
});
`)
  findings := NewEngine(RuleConfig{"vitest/no-conditional-expect": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  assertVitestOrdinaryRuleErrors(t, "vitest/no-conditional-expect", findings)
  if len(findings) != 1 || findings[0].Rule != "vitest/no-conditional-expect" {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "vitest/no-conditional-expect", "it(\"always\", () => { expect(value).toBe(1); });\n")
}
