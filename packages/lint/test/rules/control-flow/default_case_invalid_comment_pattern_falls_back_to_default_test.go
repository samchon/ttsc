package linthost

import "testing"

// TestDefaultCaseInvalidCommentPatternFallsBackToDefault verifies an uncompilable commentPattern degrades to the default marker.
//
// ESLint throws at rule creation on a bad regex; this host cannot fail the
// whole run for one rule's option, so the rule keeps the default marker rather
// than silently reporting every marked switch (mirrors no-fallthrough).
//
// 1. Keep the standard `// no default` marker.
// 2. Run the engine with the invalid options {"commentPattern":"("}.
// 3. Assert zero findings (default pattern still honored).
func TestDefaultCaseInvalidCommentPatternFallsBackToDefault(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // no default
}
`, `{"commentPattern":"("}`)
}
