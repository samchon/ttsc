package linthost

import "testing"

// TestNoElseReturnAllowsElseIfReturnChain verifies a `return` + `else if`
// chain with no final `else` is left alone under the default `allowElseIf`.
//
// Regression for issue #598: the port ignored `allowElseIf` (upstream default
// `true`) and flagged the authored `return` followed by `else if` shape.
// Upstream's chain walk bails when the chain ends without a plain `else`,
// so nothing is reported.
//
// 1. Write `if (a) { return 1; } else if (b) { return 2; }` with no final else.
// 2. Run the engine with no-else-return enabled (default options).
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Engine requires zero findings for the original return-bearing else-if chain without a terminal plain else.
// @evidence contracts/testing.md#independent-expectations The default allowElseIf contract independently exempts this exact chain shape; an additional plain else or explicit false option changes that decision.
// @evidence contracts/testing.md#distinguishing-cases Default else-if return chain stays clean; AllowElseIfFalseReportsElseIf and ReportsOnceOnTerminalElseOfChain own those two nearest positive changes.
// @evidence contracts/testing.md#execution-ownership TestNoElseReturnAllowsElseIfReturnChain is selected in the shared Go unit population. It calls assertRuleSkipsSource on the complete authored pick fixture with default no-else-return options. No installed consumer, native artifact build or real product host runs.
func TestNoElseReturnAllowsElseIfReturnChain(t *testing.T) {
  assertRuleSkipsSource(t, "no-else-return", `declare const a: boolean;
declare const b: boolean;
function pick(): number {
  if (a) {
    return 1;
  } else if (b) {
    return 2;
  }
  return 3;
}
JSON.stringify(pick);
`)
}
