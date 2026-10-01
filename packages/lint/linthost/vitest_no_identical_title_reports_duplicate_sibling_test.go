package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoIdenticalTitleReportsDuplicateSibling verifies vitest/no-identical-title rejects duplicate sibling names.
//
// Duplicate titles make filtered runs and failure output ambiguous. This pins
// the source-file rule that tracks titles per describe scope.
//
// 1. Parse two sibling tests with the same static title.
// 2. Enable vitest/no-identical-title.
// 3. Assert exactly one diagnostic is emitted for the pair.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies two sibling tests sharing one title produce a single vitest/no-identical-title finding; the count and exact rule identity distinguish the intended diagnostic from an unrelated report.
// @evidence contracts/testing.md#independent-expectations Sibling titles must distinguish filtered runs and failure identities. The expected single finding and independently authored accepted control follow that supported policy, not engine-generated snapshots.
// @evidence contracts/testing.md#distinguishing-cases The original violation is paired with the adjacent accepted source: describe("math", () => { test("adds", () => expect(add()).toBe(1)); test("subtracts", () => expect(subtract()).toBe(2)); }); Both execute, preserving the original input and adding a zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestVitestNoIdenticalTitleReportsDuplicateSibling owns these virtual TypeScript inputs as a Go unit entry; actual lint operations execute in-process without a Vitest installation or product child host.
func TestVitestNoIdenticalTitleReportsDuplicateSibling(t *testing.T) {
  file := parseTS(t, `describe("math", () => {
  test("adds", () => expect(add()).toBe(1));
  test("adds", () => expect(add()).toBe(2));
});
`)
  findings := NewEngine(RuleConfig{"vitest/no-identical-title": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  assertVitestOrdinaryRuleErrors(t, "vitest/no-identical-title", findings)
  if len(findings) != 1 || findings[0].Rule != "vitest/no-identical-title" {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "vitest/no-identical-title", "describe(\"math\", () => { test(\"adds\", () => expect(add()).toBe(1)); test(\"subtracts\", () => expect(subtract()).toBe(2)); });\n")
}
