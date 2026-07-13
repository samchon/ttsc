package linthost

import "testing"

// TestNoFallthroughDirectiveSuppressionStillWins verifies eslint-disable-next-line keeps suppressing the finding itself.
//
// A `// eslint-disable-next-line no-fallthrough` comment is excluded from
// marker matching, but it must still work as a directive: the finding lands on
// the next case's line and the inline-disable filter drops it (upstream valid
// regression test). Locks the interplay of marker exclusion and directive
// filtering.
//
// 1. Put the disable-next-line directive directly above the fallthrough target.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings survive.
func TestNoFallthroughDirectiveSuppressionStillWins(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
    // eslint-disable-next-line no-fallthrough
  case 1:
    console.log(1);
    break;
}
`, "")
}
