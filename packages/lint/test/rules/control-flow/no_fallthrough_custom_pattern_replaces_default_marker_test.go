package linthost

import "testing"

// TestNoFallthroughCustomPatternReplacesDefaultMarker verifies a custom commentPattern disables the default marker.
//
// ESLint compiles the custom pattern INSTEAD of the default one, so a
// standard `// falls through` stops being accepted once a project configures
// its own wording (upstream invalid regression). Negative twin of the
// custom-pattern acceptance, one property away (the comment text kept at the
// default spelling).
//
// 1. Mark the transition with `// falls through` under a custom pattern.
// 2. Run the engine with options {"commentPattern":"break omitted"}.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughCustomPatternReplacesDefaultMarker(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // falls through
  case 1:
    console.log(1);
    break;
}
`, `{"commentPattern":"break omitted"}`, 6)
}
