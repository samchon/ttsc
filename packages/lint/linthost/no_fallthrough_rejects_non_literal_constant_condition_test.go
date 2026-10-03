package linthost

import "testing"

// TestNoFallthroughRejectsNonLiteralConstantCondition verifies `while (!0)` is not constant-folded.
//
// ESLint's getBooleanValueIfSimpleConstant folds bare Literal nodes only —
// `!0` is a unary expression, so the loop is treated as exitable and the case
// falls through. The `while (1)` acceptance uses a bare truthy literal, while
// this input uses a truthy unary expression. Locks the supported folding
// boundary rather than proving the loop can terminate at runtime.
//
// 1. End a case with `while (!0) { console.log(0); }`.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert exactly one finding at the next case label.
//
// @evidence contracts/testing.md#behavioral-verification Exactly one no-fallthrough error reports on target line seven for while !0.
// @evidence contracts/testing.md#independent-expectations Supported literal-only folding deliberately treats a unary expression as unknown even if JavaScript can evaluate it statically; this is a compatibility limit, not runtime reachability proof.
// @evidence contracts/testing.md#distinguishing-cases AcceptsWhileNumericOneLiteral retains a bare truthy literal and stays clean.
// @evidence contracts/testing.md#execution-ownership TestNoFallthroughRejectsNonLiteralConstantCondition is selected in the shared Go unit population and invokes assertNoFallthroughReportsAtLines and the owning AST Engine. Every original source/options/expected line/message and in-source counterpart remains owned by this declaration; no CLI child, installed consumer, native artifact build or real product host runs.
func TestNoFallthroughRejectsNonLiteralConstantCondition(t *testing.T) {
  assertNoFallthroughReportsAtLines(t, `declare const foo: number;
switch (foo) {
  case 0:
    while (!0) {
      console.log(0);
    }
  case 1:
    console.log(1);
    break;
}
`, "", 7)
}
