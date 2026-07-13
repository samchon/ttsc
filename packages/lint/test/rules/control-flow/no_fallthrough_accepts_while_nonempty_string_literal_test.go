package linthost

import "testing"

// TestNoFallthroughAcceptsWhileNonemptyStringLiteral verifies a non-empty string literal folds to a constant-true loop test.
//
// ESLint's simple-constant folding boxes every bare Literal, so
// `while ("spin")` is an infinite loop and the case end is unreachable
// without a break. Locks the string branch of literalTruthiness.
//
// 1. End a case with `while ("spin") { console.log(0); }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsWhileNonemptyStringLiteral(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    while ("spin") {
      console.log(0);
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
