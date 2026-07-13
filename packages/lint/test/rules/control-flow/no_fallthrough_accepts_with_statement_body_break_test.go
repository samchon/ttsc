package linthost

import "testing"

// TestNoFallthroughAcceptsWithStatementBodyBreak verifies a break inside a with statement terminates the case.
//
// `with` bodies always execute, so their completion is the with statement's
// completion. TypeScript flags `with` as a grammar error but still parses
// it; the rule must not misread the break as absorbed or lost. Locks the
// with-statement passthrough of the completion analysis.
//
// 1. End a case with `with (o) { break; }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughAcceptsWithStatementBodyBreak(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
declare const o: object;
switch (foo) {
  case 0:
    with (o) {
      break;
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
