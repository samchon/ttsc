package linthost

import "testing"

// TestNoFallthroughAcceptsWithStatementBodyBreak verifies a break inside a with statement terminates the case.
//
// When evaluation enters the `with` body, its completion is the statement's
// completion. TypeScript flags `with` as a grammar error but still parses
// it; the rule must not misread the break as absorbed or lost. Locks the
// with-statement passthrough of the completion analysis.
//
// 1. End a case with `with (o) { break; }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings when a parsed with body breaks out of the case.
// @evidence contracts/testing.md#independent-expectations The authored body break has ordinary case-exit ownership; this parser-based lint test does not certify grammar validity of with.
// @evidence contracts/testing.md#distinguishing-cases Open-case reports retain normal completion while nested-function returns remain isolated.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsWithStatementBodyBreak is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
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
