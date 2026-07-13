package linthost

import "testing"

// TestNoFallthroughRejectsNestedSwitchWithoutDefault verifies a default-less nested switch cannot terminate the outer case.
//
// Without a default clause the discriminant may match nothing, in which case
// the inner switch completes normally and the outer case falls through —
// even though its only clause returns. Negative twin of the exhaustive
// nested switch, one property away (the default clause removed).
//
// 1. End an outer case with a nested switch whose single case returns.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the outer next-case label.
func TestNoFallthroughRejectsNestedSwitchWithoutDefault(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare const bar: number;
function f(): void {
  switch (foo) {
    case 0:
      switch (bar) {
        case 1:
          return;
      }
    case 1:
      console.log(1);
  }
}
JSON.stringify(f);
`, "", 10)
}
