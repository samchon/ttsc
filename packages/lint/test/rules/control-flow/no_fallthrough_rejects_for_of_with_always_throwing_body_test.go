package linthost

import "testing"

// TestNoFallthroughRejectsForOfWithAlwaysThrowingBody verifies for-of always offers normal completion.
//
// The iterated collection may be empty, so a for-of completes normally even
// when its body always throws — unlike do/while, whose body is guaranteed to
// run. Locks the for-in/for-of branch of the completion analysis as the
// negative twin of the always-throwing do/while.
//
// 1. End a case with `for (const item of items) { throw ...; }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsForOfWithAlwaysThrowingBody(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare const items: string[];
switch (foo) {
  case 0:
    for (const item of items) {
      throw new Error(item);
    }
  case 1:
    console.log(1);
    break;
}
`, "", 8)
}
