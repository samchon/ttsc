package linthost

import "testing"

// TestNoFallthroughAcceptsWhileBigintOneLiteral verifies a non-zero bigint literal folds to a constant-true loop test.
//
// `1n` is an ESTree Literal with a truthy bigint value, so ESLint treats
// `while (1n)` as infinite; the case end is unreachable without a break.
// Locks the bigint branch of literalTruthiness (normalized decimal digits).
//
// 1. End a case with `while (1n) { console.log(0); }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Zero findings for a bare nonzero BigInt loop test.
// @evidence contracts/testing.md#independent-expectations Authored 1n is truthy under the supported literal-only loop folding policy.
// @evidence contracts/testing.md#distinguishing-cases CommandPreservesBigIntLiteralTruthiness retains zero, radix, separator, arbitrary-width and unary-expression boundaries.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughAcceptsWhileBigintOneLiteral is selected in the shared Go unit population and invokes assertNoFallthroughClean and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughAcceptsWhileBigintOneLiteral(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    while (1n) {
      console.log(0);
    }
  case 1:
    console.log(1);
    break;
}
`, "")
}
