package linthost

import "testing"

// TestNoFallthroughNeverReportsLastOpenCase verifies the final case is exempt even when its end is reachable.
//
// There is no next label to fall into, so a last case without a break is
// fine (upstream valid case `case 0: a();` as the only clause). Locks the
// transition pairing: only clause pairs are examined, never the final
// clause alone.
//
// 1. Build a switch whose only case ends without a break.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification No finding reports for the sole open case.
// @evidence contracts/testing.md#independent-expectations A final clause has no next label; the authored singleton switch independently supplies the transition-boundary oracle.
// @evidence contracts/testing.md#distinguishing-cases ReportsEachUnmarkedTransitionOnce retains preceding open clauses that do have targets.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughNeverReportsLastOpenCase is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughNeverReportsLastOpenCase(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
}
`, "")
}
