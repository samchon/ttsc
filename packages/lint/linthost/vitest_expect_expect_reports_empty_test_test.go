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
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies a render-only callback is reported for vitest/expect-expect; the count and exact rule identity distinguish the intended diagnostic from an unrelated report.
// @evidence contracts/testing.md#independent-expectations A test needs an expect/assert operation to check its result. The expected single finding and independently authored accepted control follow that supported policy, not engine-generated snapshots.
// @evidence contracts/testing.md#distinguishing-cases The original violation is paired with the adjacent accepted source: test("asserts", () => { expect(value).toBe(1); }); Both execute, preserving the original input and adding a zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestVitestExpectExpectReportsEmptyTest owns these virtual TypeScript inputs as a Go unit entry; actual lint operations execute in-process without a Vitest installation or product child host.
func TestVitestExpectExpectReportsEmptyTest(t *testing.T) {
  file := parseTS(t, `test("loads", () => {
  render();
});
`)
  findings := NewEngine(RuleConfig{"vitest/expect-expect": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  assertVitestOrdinaryRuleErrors(t, "vitest/expect-expect", findings)
  if len(findings) != 1 || findings[0].Rule != "vitest/expect-expect" {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "vitest/expect-expect", "test(\"asserts\", () => { expect(value).toBe(1); });\n")
}
