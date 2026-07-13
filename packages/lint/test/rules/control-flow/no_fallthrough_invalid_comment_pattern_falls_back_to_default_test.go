package linthost

import "testing"

// TestNoFallthroughInvalidCommentPatternFallsBackToDefault verifies an uncompilable commentPattern degrades to the default marker.
//
// ESLint throws at rule creation on a bad regex; this host cannot fail the
// whole run for one rule's option, so rules_no_fallthrough.go documents the
// fallback: keep the default marker pattern rather than silently disabling
// marker recognition (which would flood marked code with false positives).
//
// 1. Mark the transition with the standard `// falls through`.
// 2. Run the engine with the invalid options {"commentPattern":"("}.
// 3. Assert zero findings (default pattern still honored).
func TestNoFallthroughInvalidCommentPatternFallsBackToDefault(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // falls through
  case 1:
    console.log(1);
    break;
}
`, `{"commentPattern":"("}`)
}
