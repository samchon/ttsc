package linthost

import "testing"

// TestDefaultCaseAcceptsEmptySwitch verifies an empty switch produces nothing.
//
// Upstream `default-case` bails on `if (!node.cases.length) return;`: an empty
// case block has no clause to hang a `// no default` marker on, so ESLint
// leaves it alone. Locks the empty-switch boundary that the pre-fix port
// wrongly reported.
//
// 1. Build `switch (foo) {}` with zero clauses.
// 2. Run the engine with default-case enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings for the actual zero-clause switch.
// @evidence contracts/testing.md#independent-expectations The supported empty-switch boundary has no last clause for marker ownership; the literal zero findings do not come from a generated snapshot.
// @evidence contracts/testing.md#distinguishing-cases Zero clauses stay clean; ReportsSwitchWithoutDefault owns the neighboring nonempty switch without a default.
// @evidence contracts/testing.md#execution-ownership TestDefaultCaseAcceptsEmptySwitch is selected in the shared Go unit population. It calls assertDefaultCaseClean and lintDefaultCase, forwarding the actual authored source and option JSON through InlineRuleResolver and Engine.Run. No installed consumer, native artifact build or real product host runs.
func TestDefaultCaseAcceptsEmptySwitch(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
}
`, "")
}
