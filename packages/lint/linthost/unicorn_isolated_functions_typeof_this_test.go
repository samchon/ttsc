package linthost

import "testing"

// TestUnicornIsolatedFunctionsTypeofThis verifies that a `this` appearing at
// the head of a type-query entity name is reported exactly once, as a `this`
// context problem, never as an externally-scoped variable.
//
// The native context walk extracts a type-query identifier head named "this".
// The reference classifier must exclude that name, so each authored type-query
// occurrence produces only its literal this-context diagnostic rather than
// an additional externally-scoped variable diagnostic.
//
// 1. Reference `typeof this` and `typeof this.foo` inside an isolated function.
// 2. Assert one `this` context report per occurrence and no variable report.
//
// @evidence contracts/testing.md#behavioral-verification runUnicornIsolatedFunctions and its exact finding assertion verify typeof this and typeof this.foo each yield one this-context report instead of duplicate variable reports; rule identity, source ranges, messages and absence of fixes/suggestions are checked by the owning helper.
// @evidence contracts/testing.md#independent-expectations The authored two exact targets/lines and this-specific reason messages specify supported TypeScript type-query treatment. Test-owned interpolation composes the literal expected sentence without calling the production reason builder.
// @evidence contracts/testing.md#distinguishing-cases Bare and qualified type-query heads report once; TestUnicornIsolatedFunctionsTypeScriptTypes owns ordinary outer-type reference exclusions and ThisAndSuper owns context boundaries.
// @evidence contracts/testing.md#execution-ownership TestUnicornIsolatedFunctionsTypeofThis is a discoverable Go unit host; its literal option/source cases run the owning checker-backed lint operation in the shared Go process, without browser execution, installation, native builds or product children. Each failure retains line, target and reason identity.
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
