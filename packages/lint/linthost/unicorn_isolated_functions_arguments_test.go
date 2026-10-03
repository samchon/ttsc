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
//
// @evidence contracts/testing.md#behavioral-verification runUnicornIsolatedFunctions and its exact finding assertion verify own non-arrow arguments stays local while an isolated arrow captures outer arguments; rule identity, source ranges, messages and absence of fixes/suggestions are checked by the owning helper.
// @evidence contracts/testing.md#independent-expectations The authored target/line/message records express upstream own-function arguments ownership. Test-owned message interpolation composes the authored upstream sentence and does not call the production reason builder.
// @evidence contracts/testing.md#distinguishing-cases The same arguments.length expression changes verdict only when its owning non-arrow function lies outside the isolated callback.
// @evidence contracts/testing.md#execution-ownership TestUnicornIsolatedFunctionsArguments is a discoverable Go unit host; its literal option/source cases run the owning checker-backed lint operation in the shared Go process, without browser execution, installation, native builds or product children. Each failure retains line, target and reason identity.
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
