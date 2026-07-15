package linthost

import "testing"

// TestDefaultCaseHonorsCustomCommentPattern verifies the commentPattern option accepts a matching custom marker.
//
// Upstream compiles `new RegExp(options.commentPattern, "u")`, letting a
// project standardize its own marker wording, delivered through the typed rule
// options transport. Locks the custom-pattern compilation and matching path.
//
// 1. Mark the omission with `// skip default`.
// 2. Run the engine with options {"commentPattern":"^skip default$"}.
// 3. Assert zero findings.
func TestDefaultCaseHonorsCustomCommentPattern(t *testing.T) {
  assertDefaultCaseClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  // skip default
}
`, `{"commentPattern":"^skip default$"}`)
}
