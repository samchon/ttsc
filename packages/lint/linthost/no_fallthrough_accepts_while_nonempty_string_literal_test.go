package linthost

import "testing"

// TestNoFallthroughAcceptsWhileNonemptyStringLiteral verifies a non-empty string literal folds to a constant-true loop test.
//
// ESLint's simple-constant folding converts bare Literal values to booleans, so
// `while ("spin")` is an infinite loop and the case end is unreachable
// without a break. Locks the string branch of literalTruthiness.
//
// 1. End a case with `while ("spin") { console.log(0); }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for a bare nonempty string loop test.
// @evidence contracts/testing.md#independent-expectations The literal spin has a truthy value; the oracle pins supported literal folding rather than symbolic constant evaluation.
// @evidence contracts/testing.md#distinguishing-cases RejectsNonLiteralConstantCondition keeps the unary-expression boundary reportable.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsWhileNonemptyStringLiteral is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsWhileNonemptyStringLiteral(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    while ("spin") {
      console.log(0);
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
