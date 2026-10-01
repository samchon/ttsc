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
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies an empty title is reported for vitest/valid-title; the count and exact rule identity distinguish the intended diagnostic from an unrelated report.
// @evidence contracts/testing.md#independent-expectations A nonempty static string identifies the case. The expected single finding and independently authored accepted control follow that supported policy, not engine-generated snapshots.
// @evidence contracts/testing.md#distinguishing-cases The original violation is paired with the adjacent accepted source: test("named", () => { expect(value).toBe(1); }); Both execute, preserving the original input and adding a zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestVitestValidTitleReportsEmptyTitle owns these virtual TypeScript inputs as a Go unit entry; actual lint operations execute in-process without a Vitest installation or product child host.
func TestVitestValidTitleReportsEmptyTitle(t *testing.T) {
  file := parseTS(t, `test("", () => {
  expect(value).toBe(1);
});
`)
  findings := NewEngine(RuleConfig{"vitest/valid-title": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  assertVitestOrdinaryRuleErrors(t, "vitest/valid-title", findings)
  if len(findings) != 1 || findings[0].Rule != "vitest/valid-title" {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "vitest/valid-title", "test(\"named\", () => { expect(value).toBe(1); });\n")
}
