package linthost

import "testing"

// TestNoElseReturnAllowsElseIfReturnChain verifies a `return` + `else if`
// chain with no final `else` is left alone under the default `allowElseIf`.
//
// Regression for issue #598: the port ignored `allowElseIf` (upstream default
// `true`) and flagged `return` followed by `else if`, one of the most common
// TypeScript control-flow shapes. Upstream's chain walk bails when the chain
// ends without a plain `else`, so nothing is reported.
//
// 1. Write `if (a) { return 1; } else if (b) { return 2; }` with no final else.
// 2. Run the engine with no-else-return enabled (default options).
// 3. Assert zero findings.
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
