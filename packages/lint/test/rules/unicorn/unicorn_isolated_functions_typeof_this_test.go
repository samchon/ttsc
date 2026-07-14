package linthost

import "testing"

// TestUnicornIsolatedFunctionsTypeofThis verifies that a `this` appearing at
// the head of a type-query entity name is reported exactly once, as a `this`
// context problem, never as an externally-scoped variable.
//
// ESTree models `typeof this` and `typeof this.foo` with a ThisExpression, so
// upstream yields a single `this` context report. TypeScript-Go instead spells
// the qualified-name head as an identifier named "this"; the port must route
// it through the context walk only, or it would double-report a nonsensical
// "Variable this not defined in scope".
//
// 1. Reference `typeof this` and `typeof this.foo` inside an isolated function.
// 2. Assert one `this` context report per occurrence and no variable report.
func TestUnicornIsolatedFunctionsTypeofThis(t *testing.T) {
  reason := `callee of function named "makeSynchronous"`
  source := `declare function makeSynchronous<T>(fn: T): T;

makeSynchronous(function () {
  let a: typeof this;
  let b: typeof this.foo;
  return [a, b];
});
`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, source, ""),
    unicornIsolatedFunctionsFinding{
      line:    4,
      target:  "this",
      message: unicornIsolatedFunctionsThisMessage(reason),
    },
    unicornIsolatedFunctionsFinding{
      line:    5,
      target:  "this",
      message: unicornIsolatedFunctionsThisMessage(reason),
    },
  )
}
