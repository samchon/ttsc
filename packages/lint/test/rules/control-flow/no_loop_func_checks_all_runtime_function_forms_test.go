package linthost

import "testing"

// TestNoLoopFuncChecksAllRuntimeFunctionForms verifies TypeScript AST function
// kinds that correspond to ESLint function-expression nodes are analyzed.
//
// Object methods, class methods, accessors, and constructors use dedicated
// TypeScript-Go kinds. Treating only arrow and `function` syntax as functions
// would leave the same unsafe closure reachable through these equivalent forms.
//
// 1. Declare every runtime function form inside one loop.
// 2. Capture an outer binding that is reassigned after the loop.
// 3. Assert every function-shaped range receives the same unsafe diagnostic.
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
