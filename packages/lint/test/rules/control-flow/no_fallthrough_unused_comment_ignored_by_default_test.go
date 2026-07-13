package linthost

import "testing"

// TestNoFallthroughUnusedCommentIgnoredByDefault verifies unused markers stay silent without the option.
//
// reportUnusedFallthroughComment defaults to false upstream, so the exact
// source that reports with the option enabled must produce nothing under the
// scalar default configuration. Negative twin of the unused-comment report,
// one property away (the option removed).
//
// 1. Put a marker between a breaking case and the next label.
// 2. Run the engine with no options.
// 3. Assert zero findings.
func TestNoFallthroughUnusedCommentIgnoredByDefault(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    break;
  /* falls through */
  case 1:
    console.log(1);
}
`, "")
}
