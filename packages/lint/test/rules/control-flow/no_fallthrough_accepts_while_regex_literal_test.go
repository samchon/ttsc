package linthost

import "testing"

// TestNoFallthroughAcceptsWhileRegexLiteral verifies a regex literal folds to a constant-true loop test.
//
// A regex object is always truthy and is an ESTree Literal, so ESLint's
// simple-constant folding makes `while (/spin/)` infinite; the case end is
// unreachable without a break. Locks the regex branch of literalTruthiness.
//
// 1. End a case with `while (/spin/) { console.log(0); }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsWhileRegexLiteral(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    while (/spin/) {
      console.log(0);
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
