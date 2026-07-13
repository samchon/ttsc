package linthost

import "testing"

// TestNoFallthroughAcceptsWhileBigintOneLiteral verifies a non-zero bigint literal folds to a constant-true loop test.
//
// `1n` is an ESTree Literal with a truthy bigint value, so ESLint treats
// `while (1n)` as infinite; the case end is unreachable without a break.
// Locks the bigint branch of literalTruthiness (normalized decimal digits).
//
// 1. End a case with `while (1n) { console.log(0); }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsWhileBigintOneLiteral(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    while (1n) {
      console.log(0);
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
