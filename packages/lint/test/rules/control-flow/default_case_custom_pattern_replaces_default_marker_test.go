package linthost

import "testing"

// TestDefaultCaseCustomPatternReplacesDefaultMarker verifies a custom commentPattern disables the default marker.
//
// ESLint compiles the custom pattern INSTEAD of the default one, so the
// standard `// no default` stops being accepted once a project configures its
// own wording (upstream invalid regression). Negative twin of the
// custom-pattern acceptance, one property away (the comment kept at the
// default spelling).
//
// 1. Keep the default `// no default` marker under a custom pattern.
// 2. Run the engine with options {"commentPattern":"^skip default$"}.
// 3. Assert exactly one finding at the switch statement (line 2).
func TestDefaultCaseCustomPatternReplacesDefaultMarker(t *testing.T) {
  assertDefaultCaseReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // no default
}
`, `{"commentPattern":"^skip default$"}`, 2)
}
