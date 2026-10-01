package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestPreferToHaveLengthReportsLengthMatcher verifies vitest/prefer-to-have-length flags .length equality.
//
// Matching `.length` through equality hides the more specific Vitest matcher.
// This pins the matcher-chain recognizer for `expect(value.length).toBe(n)`.
//
// 1. Parse an expect call that asserts on `.length`.
// 2. Enable vitest/prefer-to-have-length.
// 3. Assert one diagnostic is emitted.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies toBe over items.length is reported for vitest/prefer-to-have-length; the count and exact rule identity distinguish the intended diagnostic from an unrelated report.
// @evidence contracts/testing.md#independent-expectations toHaveLength expresses collection length directly. The expected single finding and independently authored accepted control follow that supported policy, not engine-generated snapshots.
// @evidence contracts/testing.md#distinguishing-cases The original violation is paired with the adjacent accepted source: test("length", () => { expect(items).toHaveLength(3); }); Both execute, preserving the original input and adding a zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestVitestPreferToHaveLengthReportsLengthMatcher owns these virtual TypeScript inputs as a Go unit entry; actual lint operations execute in-process without a Vitest installation or product child host.
func TestVitestPreferToHaveLengthReportsLengthMatcher(t *testing.T) {
  file := parseTS(t, `test("length", () => {
  expect(items.length).toBe(3);
});
`)
  findings := NewEngine(RuleConfig{"vitest/prefer-to-have-length": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  assertVitestOrdinaryRuleErrors(t, "vitest/prefer-to-have-length", findings)
  if len(findings) != 1 || findings[0].Rule != "vitest/prefer-to-have-length" {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "vitest/prefer-to-have-length", "test(\"length\", () => { expect(items).toHaveLength(3); });\n")
}
