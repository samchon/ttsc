package linthost

import "testing"

// TestNoFallthroughAcceptsWhileRegexLiteral verifies a regex literal folds to a constant-true loop test.
//
// A regex object is always truthy and is an ESTree Literal, so ESLint's
// simple-constant folding makes `while (/spin/)` infinite; the case end is
// unreachable without a break. Locks the regex branch of literalTruthiness.
//
// 1. End a case with `while (/spin/) { console.log(0); }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for a bare RegExp literal loop test.
// @evidence contracts/testing.md#independent-expectations A RegExp literal yields a truthy object under the supported literal folding contract.
// @evidence contracts/testing.md#distinguishing-cases RejectsNonLiteralConstantCondition distinguishes literal folding from general constant-expression evaluation.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsWhileRegexLiteral is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsWhileRegexLiteral(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    while (/spin/) {
      console.log(0);
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
