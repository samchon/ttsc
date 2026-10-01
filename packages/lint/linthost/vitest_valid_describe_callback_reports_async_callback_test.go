package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestValidDescribeCallbackReportsAsyncCallback verifies vitest/valid-describe-callback rejects async describes.
//
// Describe callbacks define suite structure and must run synchronously. This
// locks the callback extraction and async modifier check for describe blocks.
//
// 1. Parse an async describe callback.
// 2. Enable vitest/valid-describe-callback.
// 3. Assert one diagnostic is emitted.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies an async describe callback is reported for vitest/valid-describe-callback; the count and exact rule identity distinguish the intended diagnostic from an unrelated report.
// @evidence contracts/testing.md#independent-expectations Suite-registration callbacks must finish synchronously. The expected single finding and independently authored accepted control follow that supported policy, not engine-generated snapshots.
// @evidence contracts/testing.md#distinguishing-cases The original violation is paired with the adjacent accepted source: describe("suite", () => { test("case", () => expect(value).toBe(1)); }); Both execute, preserving the original input and adding a zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestVitestValidDescribeCallbackReportsAsyncCallback owns these virtual TypeScript inputs as a Go unit entry; actual lint operations execute in-process without a Vitest installation or product child host.
func TestVitestValidDescribeCallbackReportsAsyncCallback(t *testing.T) {
  file := parseTS(t, `describe("suite", async () => {
  test("case", () => expect(value).toBe(1));
});
`)
  findings := NewEngine(RuleConfig{"vitest/valid-describe-callback": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  assertVitestOrdinaryRuleErrors(t, "vitest/valid-describe-callback", findings)
  if len(findings) != 1 || findings[0].Rule != "vitest/valid-describe-callback" {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "vitest/valid-describe-callback", "describe(\"suite\", () => { test(\"case\", () => expect(value).toBe(1)); });\n")
}
