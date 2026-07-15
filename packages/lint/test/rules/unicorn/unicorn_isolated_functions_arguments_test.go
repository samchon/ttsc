package linthost

import "testing"

// TestUnicornIsolatedFunctionsArguments verifies the `arguments` special case:
// the isolated non-arrow function's own `arguments` object is a local, but an
// `arguments` captured from an enclosing function through an isolated arrow
// escapes the isolated scope.
//
// The checker gives `arguments` no declaration, so the port locates its owning
// non-arrow function syntactically: owned inside the isolated function it is a
// local (clean); owned outside it is a captured binding (reported).
//
//  1. Assert a makeSynchronous function expression using its own `arguments`
//     stays clean.
//  2. Assert an isolated arrow reaching the enclosing function's `arguments`
//     reports it.
func TestUnicornIsolatedFunctionsArguments(t *testing.T) {
  own := `declare function makeSynchronous<T>(fn: T): T;

makeSynchronous(function () {
  return arguments.length;
});
`
  assertUnicornIsolatedFunctionsFindings(t, runUnicornIsolatedFunctions(t, own, ""))

  captured := `declare function makeSynchronous<T>(fn: T): T;

function outer() {
  return makeSynchronous(() => arguments.length);
}
outer();
`
  assertUnicornIsolatedFunctionsFindings(
    t,
    runUnicornIsolatedFunctions(t, captured, ""),
    unicornIsolatedFunctionsFinding{
      line:    4,
      target:  "arguments",
      message: unicornIsolatedFunctionsVariableMessage("arguments", `callee of function named "makeSynchronous"`),
    },
  )
}
