package linthost

import "testing"

// TestNoLoopFuncChecksAllRuntimeFunctionForms verifies TypeScript AST function
// kinds that correspond to ESLint function-expression nodes are analyzed.
//
// Object methods, class methods, accessors, and constructors use dedicated
// TypeScript-Go kinds. Treating only arrow and `function` syntax as functions
// would leave the same unsafe closure reachable through these equivalent forms.
//
// 1. Declare the authored declaration/method/accessor/constructor forms in a loop.
// 2. Capture an outer binding that is reassigned after the loop.
// 3. Assert every function-shaped range receives the same unsafe diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Checker-backed findings must match all eight authored function/accessor/constructor ranges, lines and exact outer-variable messages, without edits.
// @evidence contracts/testing.md#independent-expectations Every fixed function-shaped target captures the same outer binding written later; literal source ranges and message names are independent of checker output.
// @evidence contracts/testing.md#distinguishing-cases Declaration, object method/getter/setter and class constructor/method/getter/setter report; AllowsSafeBindingsAndExcludedHeaders owns no-capture and safe-binding counterparts.
// @evidence contracts/testing.md#execution-ownership TestNoLoopFuncChecksAllRuntimeFunctionForms is selected in the shared Go unit population. It calls runNoLoopFunc and assertNoLoopFuncFindings through the owning Engine with a real Program/Checker; all authored in-source cases belong to this entry. No installed consumer, native artifact build or real product host runs.
func TestNoLoopFuncChecksAllRuntimeFunctionForms(t *testing.T) {
  source := `let outer = 0;
for (let iteration = 0; iteration < 1; iteration++) {
  function declared() { return outer; }
  const object = {
    method() { return outer; },
    get value() { return outer; },
    set value(next: number) { outer = next; },
  };
  class Box {
    constructor() { void outer; }
    method() { return outer; }
    get value() { return outer; }
    set value(next: number) { outer = next; }
  }
  void [declared, object, Box];
}
outer = 1;
`
  message := "Function declared in a loop contains unsafe references to variable(s) 'outer'."
  assertNoLoopFuncFindings(
    t,
    runNoLoopFunc(t, source),
    noLoopFuncFinding{line: 3, target: "function declared() { return outer; }", message: message},
    noLoopFuncFinding{line: 5, target: "method() { return outer; }", message: message},
    noLoopFuncFinding{line: 6, target: "get value() { return outer; }", message: message},
    noLoopFuncFinding{line: 7, target: "set value(next: number) { outer = next; }", message: message},
    noLoopFuncFinding{line: 10, target: "constructor() { void outer; }", message: message},
    noLoopFuncFinding{line: 11, target: "method() { return outer; }", message: message},
    noLoopFuncFinding{line: 12, target: "get value() { return outer; }", message: message},
    noLoopFuncFinding{line: 13, target: "set value(next: number) { outer = next; }", message: message},
  )
}
