package linthost

import "testing"

// TestNoFallthroughAcceptsMarkedFallthroughVariants verifies no-fallthrough accepts every default marker spelling.
//
// ESLint's default marker pattern is /falls?\s?through/i, so `falls through`,
// `fall through`, `fallsthrough`, `fallthrough`, and any letter case must all
// suppress the transition. Locks the default-pattern translation in
// rules_no_fallthrough.go against accidental narrowing (e.g. hard-coding one
// exact string).
//
// 1. Build a switch whose every transition carries a different marker spelling.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsMarkedFallthroughVariants(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // falls through
  case 1:
    console.log(1);
    /* fall through */
  case 2:
    console.log(2);
    // fallsthrough
  case 3:
    console.log(3);
    /* FALLS THROUGH */
  case 4:
    console.log(4);
    // fallthrough
  case 5:
    console.log(5);
}
`, "")
}
