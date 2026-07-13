package linthost

import "testing"

// TestNoFallthroughRejectsReturnInsideArrow verifies a nested arrow's return does not terminate the case.
//
// Same function-boundary rule as the function-expression twin, but through an
// arrow with a block body — the shape callbacks most often take. The case
// still reaches its end after the arrow runs, so the transition must report.
//
// 1. End a case with an immediately-invoked arrow whose body returns.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
func TestNoFallthroughRejectsReturnInsideArrow(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
declare function run(callback: () => void): void;
switch (foo) {
  case 0:
    run(() => {
      return;
    });
  case 1:
    console.log(1);
    break;
}
`, "", 8)
}
