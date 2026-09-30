package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestNoDoneCallbackReportsTestParameter verifies vitest/no-done-callback rejects callback-style async tests.
//
// Vitest tests should return or await promises instead of accepting a done
// callback. This locks the callback-argument lookup for test declarations.
//
// 1. Parse a test callback with one parameter.
// 2. Enable vitest/no-done-callback.
// 3. Assert one diagnostic is emitted.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run verifies a done parameter is reported for vitest/no-done-callback; the count and exact rule identity distinguish the intended diagnostic from an unrelated report.
// @evidence contracts/testing.md#independent-expectations Promise completion replaces the unsupported done-callback lifecycle. The expected single finding and independently authored accepted control follow that supported policy, not engine-generated snapshots.
// @evidence contracts/testing.md#distinguishing-cases The original violation is paired with the adjacent accepted source: it("promise", async () => {}); Both execute, preserving the original input and adding a zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestVitestNoDoneCallbackReportsTestParameter owns these virtual TypeScript inputs as a Go unit entry; actual lint operations execute in-process without a Vitest installation or product child host.
func TestVitestNoDoneCallbackReportsTestParameter(t *testing.T) {
  file := parseTS(t, `it("uses callback", (done) => {
  done();
});
`)
  findings := NewEngine(RuleConfig{"vitest/no-done-callback": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  assertVitestOrdinaryRuleErrors(t, "vitest/no-done-callback", findings)
  if len(findings) != 1 || findings[0].Rule != "vitest/no-done-callback" {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
  recordFindingBehavioralWitnesses(t, findings, behavioralWitnessEngine)
  assertRuleSkipsSource(t, "vitest/no-done-callback", "it(\"promise\", async () => {});\n")
}
